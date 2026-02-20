
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileUp } from 'lucide-react';
import { ManualGenerator } from '@/components/ManualGenerator';
import { BatchGenerator } from '@/components/BatchGenerator';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 md:p-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center gap-2">
            <FileText className="w-8 h-8 text-accent-foreground" /> DocuMint
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground pt-2">
            Generate DOCX files from templates and user input, manually or in a batch from a CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">
                <FileText className="mr-2 h-4 w-4" />
                Manual Generator
              </TabsTrigger>
              <TabsTrigger value="batch">
                <FileUp className="mr-2 h-4 w-4" />
                Batch Generator (CSV)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-6">
                <ManualGenerator />
            </TabsContent>
            <TabsContent value="batch" className="pt-6">
                <BatchGenerator />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
