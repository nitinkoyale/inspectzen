
"use client";

import React, { useEffect, useState, useMemo, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useInspectionData } from '@/hooks/useInspectionData';
import type { InspectionRecord, PartName, MaterialInspectionData, FinalInspectionData, TpiInspectionData, DispatchSectionData, RejectionEntry } from '@/lib/types';
import { SLUG_TO_PART_NAME_MAP } from '@/lib/constants';
import { format, subDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingDown, AlertOctagon, ListChecks, Loader2, RefreshCw } from 'lucide-react'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const DataRow = React.memo(function DataRow({ label, value }: { label: string, value: string | number | undefined | null }) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
      <TableCell>{value !== undefined && value !== null ? value : '-'}</TableCell>
    </TableRow>
  );
});

interface SectionCardProps<T extends object> {
  title: string;
  icon?: React.ElementType;
  data: T | undefined | null;
  fields: Array<{ key: keyof T, label: string, subKeys?: Array<{key: string, label: string}> }>;
}

const SectionCard = React.memo(function SectionCard<T extends object>({ title, icon: Icon, data, fields }: SectionCardProps<T>) {
  if (!data) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available for this section.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          {Icon && <Icon className="h-5 w-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {fields.map(field => {
              if (field.subKeys && typeof data[field.key] === 'object' && data[field.key] !== null) {
                const subObject = data[field.key] as Record<string, any>;
                return (
                  <Fragment key={String(field.key)}>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold text-secondary-foreground bg-secondary/30 py-2 px-4">{field.label}</TableCell>
                    </TableRow>
                    {field.subKeys.map(subField => (
                       <TableRow key={`${String(field.key)}-${subField.key}`}>
                         <TableCell className="pl-8 py-2 pr-2 font-medium text-muted-foreground">{subField.label}</TableCell>
                         <TableCell className="py-2 px-2">{subObject[subField.key] !== undefined ? subObject[subField.key] : '-'}</TableCell>
                       </TableRow>
                    ))}
                  </Fragment>
                );
              }
              return <DataRow key={String(field.key)} label={field.label} value={data[field.key] as string | number | undefined} />;
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});

interface RejectionDetailsTableProps {
  title: string;
  rejections: RejectionEntry[] | undefined;
  partName: PartName | null;
}

const RejectionDetailsTable = React.memo(function RejectionDetailsTable({ title, rejections, partName }: RejectionDetailsTableProps) {
  if (!rejections || rejections.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <ListChecks className="h-5 w-5" />
            {title} for {partName || "Selected Part"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No rejection data logged for this stage.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-600">
          <ListChecks className="h-5 w-5" />
          {title} for {partName || "Selected Part"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Defect Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rejections.map((rejection, index) => (
                <TableRow key={index}>
                  <TableCell>{rejection.defectType}</TableCell>
                  <TableCell className="text-right">{rejection.quantity}</TableCell>
                  <TableCell>{rejection.remarks || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});


export default function PartReportPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const { records, getRecordByDatePartAndShift, isLoading: isInspectionDataLoading } = useInspectionData();
  const [reportData, setReportData] = useState<InspectionRecord | null>(null);
  const [partName, setPartName] = useState<PartName | null>(null);
  const [reportDate, setReportDate] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState(true); 

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);


  const partSlug = typeof params.partSlug === 'string' ? params.partSlug : '';

  useEffect(() => {
    if (partSlug && currentUser) { 
      const actualPartName = SLUG_TO_PART_NAME_MAP[partSlug];
      if (actualPartName) {
        setPartName(actualPartName);
        const yesterday = subDays(new Date(), 1);
        const formattedYesterday = format(yesterday, 'yyyy-MM-dd');
        setReportDate(formattedYesterday);
        
        if (!isInspectionDataLoading) { 
          let record = getRecordByDatePartAndShift(formattedYesterday, actualPartName, "A");
          if (!record) {
            record = getRecordByDatePartAndShift(formattedYesterday, actualPartName, "B");
          }
          setReportData(record || null);
          setIsSettingUp(false); 
        }
      } else {
        router.replace('/dashboard'); 
        setIsSettingUp(false);
      }
    } else if (!partSlug) { 
        setIsSettingUp(false); 
    }
  }, [partSlug, getRecordByDatePartAndShift, router, isInspectionDataLoading, currentUser]);

  const rejectionMetrics = useMemo(() => {
    if (!reportData) return { dailyProcessStepNotOk: 0, dailyTpiRework: 0, visualRejectionPPM: 0 };

    const dailyProcessStepNotOk = 
      (reportData.finalInspection.multigauge.notOk || 0) +
      (reportData.finalInspection.visual.notOk || 0);
    
    const dailyTpiRework = reportData.tpiInspection.notOk || 0;

    const visualNotOkForPPM = reportData.finalInspection.visual.notOk || 0;
    const visualTotalProcessedForPPM = reportData.finalInspection.visual.visualDone || 0; 

    const visualRejectionPPM = visualTotalProcessedForPPM > 0 
      ? Math.round((visualNotOkForPPM / visualTotalProcessedForPPM) * 1000000) 
      : 0;

    return { dailyProcessStepNotOk, dailyTpiRework, visualRejectionPPM };
  }, [reportData]);

  const cumulativeProcessStepRejection = useMemo(() => {
    if (isInspectionDataLoading || !partName || !reportDate || records.length === 0) {
      return 0;
    }
    const parsedReportDate = parseISO(reportDate); 

    return records
      .filter(r => r.partName === partName && parseISO(r.date) <= parsedReportDate)
      .reduce((sum, record) => {
        const recordNotOk = 
          (record.finalInspection.multigauge.notOk || 0) +
          (record.finalInspection.visual.notOk || 0); // Exclude TPI rejections
        return sum + recordNotOk;
      }, 0);
  }, [records, partName, reportDate, isInspectionDataLoading]);

  const isLoading = authLoading || isInspectionDataLoading || isSettingUp;

  if (isLoading) { 
    return <div className="container mx-auto py-8 flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading report...</p></div>;
  }

  if (!currentUser && !authLoading) {
    return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to view reports.</p></div>;
  }

  if (!partName) { 
     return (
        <div className="container mx-auto py-8">
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Could not load report. Invalid part specified or data missing.</p>
            </CardContent>
          </Card>
        </div>
    );
  }


  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-headline text-foreground">Daily Inspection Report</h1>
          <p className="text-muted-foreground">
            Part: <span className="font-semibold text-primary">{partName}</span> | Date: <span className="font-semibold text-primary">{reportDate ? format(parseISO(reportDate), 'PPP') : 'N/A'}</span> (Yesterday)
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {!reportData && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>No Data Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No inspection record found for {partName} on {reportDate ? format(parseISO(reportDate), 'PPP') : 'N/A'}. Data might be for a different shift or not yet entered.</p>
          </CardContent>
        </Card>
      )}

      {reportData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard<MaterialInspectionData>
              title="Material Inspection"
              data={reportData.materialInspection}
              fields={[
                { key: 'washingPending', label: 'Washing Pending' },
                { key: 'multigaugePending', label: 'Multigauge Pending' },
              ]}
            />
            <SectionCard<FinalInspectionData>
              title="Final Inspection"
              data={reportData.finalInspection}
              fields={[
                { key: 'multigauge', label: 'Multigauge Inspection', subKeys: [
                  { key: 'total', label: 'Total Inspected'},
                  { key: 'ok', label: 'OK'},
                  { key: 'notOk', label: 'Not OK'},
                ]},
                { key: 'visual', label: 'Visual Inspection', subKeys: [
                  { key: 'pending', label: 'Pending'},
                  { key: 'visualDone', label: 'Visual Done'},
                  { key: 'ok', label: 'OK'},
                  { key: 'notOk', label: 'Not OK'},
                ]},
              ]}
            />
            <SectionCard<TpiInspectionData>
              title="TPI Inspection"
              data={reportData.tpiInspection}
              fields={[
                { key: 'pending', label: 'Pending' },
                { key: 'done', label: 'Done' },
                { key: 'ok', label: 'OK' },
                { key: 'notOk', label: 'Not OK' },
              ]}
            />
            <SectionCard<DispatchSectionData>
              title="Dispatch"
              data={reportData.dispatch}
              fields={[
                { key: 'rfd', label: 'RFD (Ready for Dispatch)', subKeys: [
                   { key: 'cumulative', label: 'Cumulative'},
                   { key: 'today', label: 'Today'},
                ]},
                { key: 'dispatch', label: 'Dispatch Status', subKeys: [
                   { key: 'cumulative', label: 'Cumulative'},
                   { key: 'today', label: 'Today'},
                ]},
              ]}
            />
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertOctagon className="h-5 w-5" />
                Rejection Summary
              </CardTitle>
              <CardDescription>Overview of rejections for {partName} on {reportData.shift ? `Shift ${reportData.shift}, ` : ''} {reportDate ? format(parseISO(reportDate), 'PPP') : 'N/A'}. PPM is based on Final Inspection Visual data.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Total 'Not OK' Today (Process Steps)</TableCell>
                    <TableCell className="font-semibold text-destructive">{rejectionMetrics.dailyProcessStepNotOk}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">TPI Rework Quantity Today</TableCell>
                    <TableCell className="font-semibold text-orange-600 flex items-center gap-1">
                        <RefreshCw className="h-4 w-4"/> {rejectionMetrics.dailyTpiRework}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Daily Rejection Rate (PPM - Final Insp. Visual)</TableCell>
                    <TableCell>{rejectionMetrics.visualRejectionPPM.toLocaleString()} PPM</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Cumulative 'Not OK' (Process Steps, Up to Report Date)</TableCell>
                    <TableCell>{cumulativeProcessStepRejection.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RejectionDetailsTable 
              title="Final Inspection - Detailed Rejections"
              rejections={reportData.rejections}
              partName={partName}
            />
            <RejectionDetailsTable
              title="TPI - Detailed Rejections"
              rejections={reportData.tpiRejections}
              partName={partName}
            />
          </div>
        </>
      )}
    </div>
  );
}

