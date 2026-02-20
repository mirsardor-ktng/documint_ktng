// Define InspectModule interface (based on docxtemplater documentation)
export interface InspectModuleType {
    tags: Record<string, unknown>;
    inspect: {
        tags: Record<string, unknown>;
        lexed: unknown;
        parsed: unknown;
        postparsed: unknown;
    };
    fullInspected: {
        tags: Record<string, unknown>;
        lexed: unknown;
        parsed: unknown;
        postparsed: unknown;
    };
    getTags(fileType: string): Record<string, unknown>;
    getAllTags(): Record<string, unknown>;
    nullGetter(part: any, scope: any, context?: any): undefined; // Made context optional as per fix
    // Add other methods/properties if needed based on actual usage
}

// Custom module for inspecting tags reliably
export class InspectModule implements InspectModuleType {
  public tags: Record<string, unknown> = {};
  public inspect: any = { tags: {} }; // Simplified for this use case
  public fullInspected: any = { tags: {} }; // Simplified
  public name: string; // Add name property

  constructor() {
    this.tags = {};
    // Required properties/methods for a docxtemplater module
    this.name = "InspectModule";
  }

  // Called by docxtemplater with the parser instance
  set(obj: any) {
    if (obj.inspect) {
      this.inspect = obj.inspect;
    }
     if (obj.fullInspected) {
      this.fullInspected = obj.fullInspected;
    }
  }

  // Method called by docxtemplater during parsing/rendering
   parse(placeHolderContent: string) {
       // Basic filter to avoid XML tags
       if (placeHolderContent && !placeHolderContent.startsWith('<') && !placeHolderContent.endsWith('>')) {
            // Further filter specific known non-placeholder patterns if needed
            if (!placeHolderContent.includes('</w:t>')) {
                this.tags[placeHolderContent] = true; // Record the tag found
            }
       }
       return {type: "placeholder", value: placeHolderContent};
   }

   // Required nullGetter for modules
    nullGetter(part: any, scope?: any, context?: any): undefined { // Make scope and context optional
        // This module doesn't change rendering, just inspects. Always return undefined during inspection.
        // Add basic check to prevent errors if context or context.scopePathItem is undefined
         if (!context || !context.scopePathItem) {
             return undefined;
         }

        // Original logic from fix, seems okay but check context validity first
         const resolved = context.scopePathItem;
         // Ensure resolved is an array before accessing length
         // Check if resolved exists and is an array before accessing length
          if (!resolved || !Array.isArray(resolved) || context.scopePathLength >= resolved.length) {
             return undefined;
         }
         const value = resolved[context.scopePathLength];
         // Ensure the value is not undefined before attempting to access properties on it
         // This check helps prevent the 'toString' error if the scope lookup resolves to undefined.
         if (value === undefined || value === null) {
             return undefined;
         }
         // If we expect 'value' to sometimes be an object/array, add specific checks here if needed.
         // For simple inspection, returning undefined when the path resolves is usually fine.
         // If the template strictly expects a string, and gets undefined, render({}) might fail.
         // For inspection, we primarily care about collecting tag *names*.

         // Return undefined, allowing the module to collect the tag name via `parse`.
         // The actual rendering happens later during generation with real data.
         return undefined;
    }


  // Public method to retrieve all found tags
  getAllTags(): Record<string, unknown> {
     const filteredTags: Record<string, unknown> = {};
     // Prefer tags collected during parse as inspect.tags might contain resolved values
     const potentialTags = this.tags;
     for (const key in potentialTags) {
         if (Object.prototype.hasOwnProperty.call(potentialTags, key)) {
             // Filter out keys that are likely XML/internal tags or contain complex structures
             // Ensure it's a simple word possibly with underscores/numbers
              if (/^[a-zA-Z0-9_]+$/.test(key)) {
                 // Exclude auto-generated fields if they appear raw in template (shouldn't normally)
                 if (key !== 'director_name_genitive' && !key.includes('_words')) {
                     filteredTags[key] = potentialTags[key];
                 } else if (key.includes('_words')) {
                    // Check if corresponding _am field exists
                    const baseAmField = key.replace(/_words.*$/, '_am');
                    if (potentialTags.hasOwnProperty(baseAmField)) {
                       // Only include the _words field if the base _am field is also present
                        filteredTags[key] = potentialTags[key];
                    }
                 } else if (key === 'director_name_genitive') {
                     // Only include genitive if base director_name exists
                     if (potentialTags.hasOwnProperty('director_name')) {
                        filteredTags[key] = potentialTags[key];
                     }
                 }
             }
         }
     }
     // Additional check on inspect.tags if the above yields nothing, applying same filter
      if (Object.keys(filteredTags).length === 0 && this.inspect.tags) {
          for (const key in this.inspect.tags) {
               if (Object.prototype.hasOwnProperty.call(this.inspect.tags, key)) {
                   if (/^[a-zA-Z0-9_]+$/.test(key)) {
                       // Exclude auto-generated fields here too
                        if (key !== 'director_name_genitive' && !key.includes('_words')) {
                            filteredTags[key] = this.inspect.tags[key];
                        } else if (key.includes('_words')) {
                            const baseAmField = key.replace(/_words.*$/, '_am');
                            if (this.inspect.tags.hasOwnProperty(baseAmField)) {
                                filteredTags[key] = this.inspect.tags[key];
                            }
                        } else if (key === 'director_name_genitive') {
                            if (this.inspect.tags.hasOwnProperty('director_name')) {
                                filteredTags[key] = this.inspect.tags[key];
                            }
                        }
                   }
               }
           }
      }
     return filteredTags;
  }

   // Additional required methods/properties for a basic module
    optionsTransformer(options: any, docxtemplater: any) {
        // No options transformation needed for inspection
        return options;
    }
    preparse(content: string, options: any) { return content;}
    postparse(postparsed: any, options: any) { return postparsed; }
    render(part: any, options: any) { /* no custom rendering */}
    postrender(parts: any, options: any) { return parts; }
    errorsTransformer(errors: any[]) { return errors; }
    getNearestParagraph(options: any) { /* Optional */}
    getStructuredTags(fileType: string) { return this.inspect.tags;} // Alias
    getFileType() { return "docx"; } // Assume docx
    matchers(): any[] { return []; } // No custom matchers needed


}
