'use client';

import type { ChangeEvent } from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, Download, AlertCircle, RotateCcw, FileUp, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { generateBatchDocuments } from '@/actions/generateBatch';


export function BatchGenerator() {
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [templateFileName, setTemplateFileName] = useState<string>('');
    const [csvFileName, setCsvFileName] = useState<string>('');
    const [generatedZipBase64, setGeneratedZipBase64] = useState<string | null>(null);
    
    const templateInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>, type: 'template' | 'csv') => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (type === 'template') {
            if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                setError('Invalid template file type. Please upload a .docx file.');
                setTemplateFile(null);
                setTemplateFileName('');
                return;
            }
            setTemplateFile(file);
            setTemplateFileName(file.name);
        } else { // CSV
            if (!file.name.endsWith('.csv')) {
                 setError('Invalid data file type. Please upload a .csv file.');
                 setCsvFile(null);
                 setCsvFileName('');
                 return;
            }
            setCsvFile(file);
            setCsvFileName(file.name);
        }
        setError(null);
        setGeneratedZipBase64(null);
    };

    const handleReset = () => {
        setTemplateFile(null);
        setCsvFile(null);
        setIsProcessing(false);
        setError(null);
        setTemplateFileName('');
        setCsvFileName('');
        setGeneratedZipBase64(null);
        if (templateInputRef.current) templateInputRef.current.value = '';
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    const handleSubmit = async () => {
        if (!templateFile || !csvFile) {
            setError('Please upload both a template and a CSV file.');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setGeneratedZipBase64(null);

        try {
            const templateBuffer = await templateFile.arrayBuffer();
            const csvText = await csvFile.text();

            const result = await generateBatchDocuments(templateBuffer, csvText);

            if (result.success && result.base64) {
                setGeneratedZipBase64(result.base64);
            } else {
                setError(result.error || 'Failed to generate the documents.');
            }
        } catch (err) {
            console.error('Error generating batch documents:', err);
            setError('An unexpected error occurred during batch generation.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (generatedZipBase64) {
            const byteCharacters = atob(generatedZipBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/zip' });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated_documents.zip';
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
                <Label className="text-lg font-medium">1. Upload Files</Label>
                <div className="p-4 border rounded-md space-y-4 bg-secondary/30">
                    {/* Template Upload */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                         <Input
                           ref={templateInputRef}
                           id="template-upload-batch"
                           type="file"
                           accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                           onChange={(e) => handleFileChange(e, 'template')}
                           className="hidden"
                           disabled={isProcessing}
                         />
                         <Button
                            variant="outline"
                            onClick={() => templateInputRef.current?.click()}
                            disabled={isProcessing}
                            className="flex-shrink-0 w-full sm:w-auto"
                         >
                           <Upload className="mr-2 h-4 w-4" />
                           {templateFileName ? 'Change Template' : 'Choose Template (.docx)'}
                         </Button>
                         {templateFileName && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm text-muted-foreground truncate" title={templateFileName}>{templateFileName}</span>
                            </div>
                          )}
                    </div>
                     {/* CSV Upload */}
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                         <Input
                           ref={csvInputRef}
                           id="csv-upload-batch"
                           type="file"
                           accept=".csv"
                           onChange={(e) => handleFileChange(e, 'csv')}
                           className="hidden"
                           disabled={isProcessing}
                         />
                         <Button
                            variant="outline"
                            onClick={() => csvInputRef.current?.click()}
                            disabled={isProcessing}
                            className="flex-shrink-0 w-full sm:w-auto"
                         >
                           <FileUp className="mr-2 h-4 w-4" />
                           {csvFileName ? 'Change Data' : 'Choose Data (.csv)'}
                         </Button>
                         {csvFileName && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-sm text-muted-foreground truncate" title={csvFileName}>{csvFileName}</span>
                            </div>
                          )}
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground">The first row of the CSV must contain headers matching the template placeholders (e.g., contract_num, company_name).</p>
            </div>
            
            <div className="flex items-center gap-4">
                <Button
                    onClick={handleSubmit}
                    disabled={isProcessing || !templateFile || !csvFile}
                    className="w-full btn-teal"
                >
                    {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Package className="mr-2 h-4 w-4" />
                    )}
                    Generate Batch
                </Button>
                {(templateFile || csvFile) && (
                     <Button
                         variant="ghost"
                         size="icon"
                         onClick={handleReset}
                         disabled={isProcessing}
                         className="text-muted-foreground hover:text-destructive flex-shrink-0"
                         aria-label="Reset form"
                       >
                         <RotateCcw className="h-5 w-5" />
                     </Button>
                )}
            </div>

            {isProcessing && (
                 <div className="space-y-2 text-center">
                    <p className="text-sm text-muted-foreground">Processing all documents... This may take a moment.</p>
                    <Progress value={undefined} className="w-full" />
                 </div>
            )}

            {generatedZipBase64 && !error && (
                <div className="space-y-2 pt-4 border-t">
                    <Label className="text-lg font-medium">2. Download Your Documents</Label>
                    <p className="text-sm text-muted-foreground">Your batch of documents is ready in a single zip file.</p>
                    <Button onClick={handleDownload} className="w-full btn-teal-outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download Documents.zip
                    </Button>
                </div>
            )}
        </div>
    );
}
