
"use server";

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import Papa from "papaparse";
import { numberToWords } from "@/lib/numberToWords";
import { getGenitiveCase, formatCurrencyUzbekSum, sanitizeFilename } from "@/lib/doc-helpers";
import { InspectModule } from "@/lib/InspectModule";

interface BatchGenerationResult {
  success: boolean;
  base64?: string;
  error?: string;
}

interface CsvDataRow {
    [key: string]: string;
}


export async function generateBatchDocuments(
  templateArrayBuffer: ArrayBuffer,
  csvText: string
): Promise<BatchGenerationResult> {
  try {
    const outputZip = new PizZip();
    
    const { data: csvData, errors: csvErrors } = Papa.parse<CsvDataRow>(csvText, {
        header: true,
        skipEmptyLines: true,
    });

    if (csvErrors.length > 0) {
        console.error("CSV Parsing Errors:", csvErrors);
        const errorMessages = csvErrors.slice(0, 5).map(e => `Row ${e.row}: ${e.message}`).join('\n');
        return { success: false, error: `Failed to parse CSV file. Please check the format.\n${errorMessages}` };
    }

    if (csvData.length === 0) {
        return { success: false, error: "CSV file is empty or contains no data rows." };
    }

    // Inspect the template to get all placeholders
    const iModule = new InspectModule();
    try {
        const inspectorZip = new PizZip(templateArrayBuffer.slice(0));
        const docInspector = new Docxtemplater(inspectorZip, { modules: [iModule] });
        docInspector.render();
    } catch (e) {
        // Errors are expected during inspection render with no data.
        // The inspector module will still have collected the tags.
    }
    const allTemplatePlaceholders = Object.keys(iModule.getAllTags());

    for (const row of csvData) {
        // IMPORTANT: Create a new PizZip instance from a *copy* of the template buffer for each document.
        // This prevents the template from being mutated across loop iterations.
        const zip = new PizZip(templateArrayBuffer.slice(0));
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // --- DATA PROCESSING LOGIC ---
        const tempRow: Record<string, any> = { ...row };

        // Handle 'director_name_genitive' if it exists in template and not in CSV
        if (allTemplatePlaceholders.includes('director_name_genitive') && tempRow['director_name'] && !tempRow['director_name_genitive']) {
            tempRow['director_name_genitive'] = getGenitiveCase(tempRow['director_name']);
        }

        // Handle all '_words' fields based on template placeholders
        for (const placeholder of allTemplatePlaceholders) {
            if (placeholder.includes('_words')) {
                const baseName = placeholder.replace(/_words.*$/, '_am');
                // Check if the corresponding amount field exists in the CSV row and the words field is not already filled
                if (tempRow[baseName] && !tempRow[placeholder]) {
                    const langMatch = placeholder.match(/_words_?(\w+)?/);
                    const lang = langMatch ? (langMatch[1] || 'ru') : 'ru';
                    const rawAmount = parseFloat(tempRow[baseName]);
                    if (!isNaN(rawAmount)) {
                        tempRow[placeholder] = numberToWords(rawAmount, lang);
                    }
                }
            }
        }
        
        // Create final data object and format amount fields with currency
        const finalData = { ...tempRow };
        for (const key in finalData) {
            if (key.includes('_am') && !key.includes('_words')) {
                finalData[key] = formatCurrencyUzbekSum(finalData[key]);
            }
        }

        doc.setData(finalData);
        // --- END DATA PROCESSING LOGIC ---

        try {
            doc.render();
        } catch (error: any) {
            // Log error but continue with other documents
            console.error(`Error rendering document for row: ${JSON.stringify(row)}`, error);
            const contractNum = row['contract_num'] || 'unknown_contract';
            const companyName = row['company_name'] || 'unknown_company';
            outputZip.file(`ERROR_${contractNum}_${companyName}.txt`, `Failed to generate document for this row. Error: ${error.message}`);
            continue; // Skip to the next row
        }

        const generatedBuffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        // Generate filename
        const contractNum = row['contract_num'] || 'unknown_contract';
        const companyName = row['company_name'] || 'unknown_company';
        const safeContractNum = sanitizeFilename(contractNum);
        const safeCompanyName = sanitizeFilename(companyName);
        const finalContractNum = safeContractNum || 'contract';
        const finalCompanyName = safeCompanyName || 'company';
        const docxFileName = `${finalContractNum} ${finalCompanyName}.docx`;

        outputZip.file(docxFileName, generatedBuffer);
    }
    
    const zipBase64 = outputZip.generate({ type: "base64" });

    return { success: true, base64: zipBase64 };

  } catch (error: any) {
    console.error("Error in generateBatchDocuments:", error);
    return { success: false, error: `An unexpected error occurred: ${error.message || 'Unknown error'}` };
  }
}
