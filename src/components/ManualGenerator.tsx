'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, Download, AlertCircle, RotateCcw } from 'lucide-react';
import { generateDocument } from '@/actions/generateDocument';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { numberToWords } from '@/lib/numberToWords';
import { cn } from '@/lib/utils';
import { InspectModule } from '@/lib/InspectModule';
import { getGenitiveCase, formatCurrencyUzbekSum, getRawNumericValue, sanitizeFilename } from '@/lib/doc-helpers';

export function ManualGenerator() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setGeneratedFileName('generated_document.docx');
  }, []);


  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setError('Invalid file type. Please upload a .docx file.');
        setTemplateFile(null);
        setPlaceholders([]);
        setFormData({});
        setFileName('');
        setGeneratedBlob(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setTemplateFile(file);
      setFileName(file.name);
      setGeneratedBlob(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result;
        if (content instanceof ArrayBuffer) {
            try {
                const zip = new PizZip(content);
                const iModule = new InspectModule();

                const doc = new Docxtemplater(zip, {
                     modules: [iModule],
                     paragraphLoop: true,
                     linebreaks: true,
                      parser: (tag) => {
                        return {
                          get: (scope: any, context: any) => {
                             if (tag === '.') return scope;
                             return undefined;
                          },
                        };
                      },
                });
                
                doc.compile();

                 try {
                    doc.render({});
                 } catch (renderError: any) {
                    if (!renderError.message || (!renderError.message.includes('toString') && !renderError.message.includes('undefined'))) {
                         console.warn("Inspection render encountered an error (might be ignorable if tags were found):", renderError.message);
                    }
                     if (renderError.properties?.id !== 'render_error' && renderError.properties?.id !== 'scope_error') {
                        console.error('Potentially problematic error during inspection render:', renderError);
                        setError(`Template Parsing Issue: ${renderError.message}. Check template syntax.`);
                     }
                 }

                const allDetectedPlaceholders = Object.keys(iModule.getAllTags());
                const finalPlaceholders: string[] = [];
                const processed = new Set<string>();

                const manualFields = allDetectedPlaceholders
                    .filter(p => !p.includes('_words') && p !== 'director_name_genitive')
                    .sort();

                manualFields.forEach(ph => {
                    if (processed.has(ph)) return;
                    
                    finalPlaceholders.push(ph);
                    processed.add(ph);

                    if (ph === 'director_name') {
                        const genitiveField = 'director_name_genitive';
                        if (allDetectedPlaceholders.includes(genitiveField)) {
                            finalPlaceholders.push(genitiveField);
                            processed.add(genitiveField);
                        }
                    }
                    else if (ph.endsWith('_am')) {
                        const baseName = ph.replace('_am', '');
                        allDetectedPlaceholders
                            .filter(p => p.startsWith(baseName) && p.includes('_words'))
                            .sort()
                            .forEach(wordField => {
                                if (!processed.has(wordField)) {
                                    finalPlaceholders.push(wordField);
                                    processed.add(wordField);
                                }
                            });
                    }
                });

                allDetectedPlaceholders.forEach(ph => {
                    if (!processed.has(ph)) {
                        finalPlaceholders.push(ph);
                    }
                });

                const userVisiblePlaceholders = finalPlaceholders.filter(p => !p.includes('_words') && p !== 'director_name_genitive');
                if (userVisiblePlaceholders.length === 0 && !error) {
                    setError("No user-editable placeholders like {placeholder_name} found, or the template might have syntax errors preventing parsing.");
                }

                setPlaceholders(finalPlaceholders);

                const initialFormData: Record<string, string> = {};
                 const currentFormData = { ...formData };
                finalPlaceholders.forEach((ph) => {
                  if (ph === 'director_name_genitive') {
                    initialFormData[ph] = getGenitiveCase(currentFormData['director_name'] || '');
                  } else if (ph.includes('_words')) {
                      const langMatch = ph.match(/_words_?(\w+)?/);
                      const lang = langMatch ? (langMatch[1] || 'ru') : 'ru';
                      const baseName = ph.replace(/_words.*$/, '_am');
                      if (currentFormData[baseName]) {
                          const rawAmount = getRawNumericValue(currentFormData[baseName]);
                          initialFormData[ph] = rawAmount !== null ? numberToWords(rawAmount, lang) : '';
                      } else {
                          initialFormData[ph] = '';
                      }
                  }
                  else {
                      initialFormData[ph] = currentFormData[ph] || '';
                  }
                });
                setFormData(initialFormData);

            } catch (err: any) {
              console.error('Error processing DOCX file:', err);
               if (err.properties && err.properties.id === 'compile_error') {
                   setError(`Template Compilation Error: ${err.properties.explanation || err.message}. Please check the template syntax near '${err.properties.postparsed?.[err.properties.offset]?.value || 'unknown tag'}'.`);
               } else if (err.message && err.message.includes("Corrupted zip")) {
                   setError("Failed to read the template file. It might be corrupted or not a valid .docx file.");
               } else {
                   setError(`Failed to process template: ${err.message || 'Unknown error'}. Ensure it's a valid .docx file.`);
               }
              handleResetInternal();
            } finally {
              setIsLoading(false);
            }
        } else {
             setError('Failed to read the file content.');
             setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
        setIsLoading(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

   const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
       const {name, value} = event.target;
       const isAmountField = name.includes('_am') && !name.includes('_words');

        setFormData((prevData) => {
            const newData = { ...prevData };

            if (isAmountField) {
                 const rawValue = value.replace(/[^0-9.]/g, '');
                 newData[name] = rawValue;

                 const baseName = name.replace('_am', '');
                 Object.keys(newData).forEach(key => {
                     if (key.startsWith(baseName) && key.includes('_words')) {
                         const langMatch = key.match(/_words_?(\w+)?/);
                         const lang = langMatch ? (langMatch[1] || 'ru') : 'ru';
                         const amount = parseFloat(rawValue);
                         if (!isNaN(amount)) {
                             newData[key] = numberToWords(amount, lang);
                         } else {
                             newData[key] = '';
                         }
                     }
                 });
            } else {
                 newData[name] = value;
                 if (name === 'director_name' && newData.hasOwnProperty('director_name_genitive')) {
                     newData['director_name_genitive'] = getGenitiveCase(value);
                 }
            }
            return newData;
        });
   };

  const handleResetInternal = () => {
      setTemplateFile(null);
      setPlaceholders([]);
      setFormData({});
      setError(null);
      setFileName('');
      setGeneratedBlob(null);
      setGeneratedFileName('generated_document.docx');
      setIsLoading(false);
      setIsProcessing(false);
  }

   const handleReset = () => {
       handleResetInternal();
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
   };


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateFile) {
      setError('Please upload a template file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setGeneratedBlob(null);

    try {
        const fileBuffer = await templateFile.arrayBuffer();

        const processedData: Record<string, string> = {};
        for (const key in formData) {
             if (key.includes('_am') && !key.includes('_words')) {
                 processedData[key] = formatCurrencyUzbekSum(formData[key]);
             }
             else {
                 processedData[key] = formData[key];
             }
        }


        const result = await generateDocument(fileBuffer, processedData);

        if (result.success && result.blob) {
            setGeneratedBlob(result.blob);
            const contractNum = formData['contract_num'] || 'unknown_contract';
            const companyName = formData['company_name'] || 'unknown_company';
            
            const safeContractNum = sanitizeFilename(contractNum);
            const safeCompanyName = sanitizeFilename(companyName);

            const finalContractNum = safeContractNum || 'contract';
            const finalCompanyName = safeCompanyName || 'company';

            setGeneratedFileName(`${finalContractNum} ${finalCompanyName}.docx`);
        } else {
            setError(result.error || 'Failed to generate the document.');
            setGeneratedBlob(null);
            setGeneratedFileName('generated_document.docx');
        }
    } catch (err) {
      console.error('Error generating document:', err);
      setError('An unexpected error occurred during document generation.');
      setGeneratedBlob(null);
       setGeneratedFileName('generated_document.docx');
    } finally {
      setIsProcessing(false);
    }
  };

   const handleDownload = () => {
       if (generatedBlob && generatedFileName) {
           const url = window.URL.createObjectURL(generatedBlob);
           const a = document.createElement('a');
           a.href = url;
           a.download = generatedFileName;
           document.body.appendChild(a);
           a.click();
           window.URL.revokeObjectURL(url);
           a.remove();
       }
   };


  return (
    <div className="space-y-6">
        {error && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
        )}

        <div className="space-y-2">
            <Label htmlFor="template-upload" className="text-lg font-medium">
            1. Upload Template (.docx)
            </Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Input
                ref={fileInputRef}
                id="template-upload"
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading || isProcessing}
                />
                <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isProcessing}
                className="flex-shrink-0 w-full sm:w-auto"
                >
                <Upload className="mr-2 h-4 w-4" />
                {fileName ? 'Change File' : 'Choose File'}
                </Button>
                {fileName && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm text-muted-foreground truncate" title={fileName}>{fileName}</span>
                    {isLoading && <Loader2 className="h-5 w-5 animate-spin text-secondary-foreground" />}
                </div>
                )}
                {(templateFile || fileName || placeholders.length > 0 || Object.keys(formData).some(k => formData[k]) || error) && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        disabled={isLoading || isProcessing}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        aria-label="Reset form"
                    >
                        <RotateCcw className="h-5 w-5" />
                    </Button>
                )}
            </div>
            <p className="text-xs text-muted-foreground">Use {'{name_am}'} for numbers. Use {'{name_words}'} (Russian) or {'{name_words_eng}'} (English) for text conversion. {'{director_name_genitive}'} is auto-generated.</p>
        </div>

        {placeholders.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Label className="text-lg font-medium">2. Fill Placeholder Values</Label>
            <ScrollArea className="h-64 w-full rounded-md border p-4 bg-secondary/30">
            <div className="space-y-4">
                {placeholders.map((placeholder) => {
                    const isAmountField = placeholder.includes('_am') && !placeholder.includes('_words');
                    const isWordsField = placeholder.includes('_words');
                    const isGenitiveField = placeholder === 'director_name_genitive';
                    const isAutoGenerated = isWordsField || isGenitiveField;
                    const displayValue = isAmountField
                        ? formatCurrencyUzbekSum(formData[placeholder])
                        : formData[placeholder] || '';

                    return (
                        <div key={placeholder} className="space-y-1">
                        <Label htmlFor={placeholder} className="text-sm font-medium text-foreground">
                            {placeholder} {isAutoGenerated ? '(Auto-generated)' : ''}
                        </Label>
                        <Input
                            id={placeholder}
                            name={placeholder}
                            value={displayValue}
                            onChange={handleInputChange}
                            placeholder={`Enter value for {${placeholder}}`}
                            className={cn(
                            "bg-card",
                            isAutoGenerated && 'text-muted-foreground italic bg-muted/50 cursor-not-allowed'
                            )}
                            disabled={isProcessing || isAutoGenerated}
                            readOnly={isAutoGenerated}
                            type={'text'}
                            inputMode={isAmountField ? "decimal" : "text"}
                            aria-describedby={isAutoGenerated ? `${placeholder}-desc` : undefined}
                        />
                        {isGenitiveField && (
                            <p id={`${placeholder}-desc`} className="text-xs text-muted-foreground">
                            Automatically generated genitive case based on {'{director_name}'}.
                            </p>
                        )}
                            {isWordsField && (
                            <p id={`${placeholder}-desc`} className="text-xs text-muted-foreground">
                                Automatically generated words based on {'{' + placeholder.replace(/_words.*$/, '_am') + '}'}.
                            </p>
                        )}
                        </div>
                    );
                })}
            </div>
            </ScrollArea>

            <Button
                type="submit"
                disabled={isProcessing || isLoading || !templateFile || placeholders.filter(p => !p.includes('_words') && p !== 'director_name_genitive').length === 0}
                className="w-full btn-teal"
                >
                {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Generate Document
                </Button>

        </form>
        )}

        {generatedBlob && !error && (
        <div className="space-y-2 pt-4 border-t">
                <Label className="text-lg font-medium">3. Download Your Document</Label>
                <p className="text-sm text-muted-foreground">Your document <span className="font-medium">'{generatedFileName}'</span> is ready.</p>
                <Button onClick={handleDownload} className="w-full btn-teal-outline">
                <Download className="mr-2 h-4 w-4" />
                Download Document
                </Button>
        </div>
        )}
    </div>
  );
}
