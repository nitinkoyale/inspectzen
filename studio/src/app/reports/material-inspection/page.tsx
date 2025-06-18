
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useInspectionData } from '@/hooks/useInspectionData';
import type { PartName, InspectionRecord } from '@/lib/types';
import { PART_NAMES_LIST } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, SearchCheck } from 'lucide-react';
import { format, startOfDay, parseISO } from 'date-fns';
import Link from 'next/link';

interface TodayPendingMaterial {
  partName: PartName;
  washingPending: number;
  multigaugePending: number;
}

export default function MaterialInspectionReportPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, isLoading: inspectionLoading } = useInspectionData();
  const [todayPendingData, setTodayPendingData] = useState<TodayPendingMaterial[]>([]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!inspectionLoading && records.length > 0) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const pending: TodayPendingMaterial[] = PART_NAMES_LIST.map(partName => {
        const partRecordsToday = records
          .filter(r => r.partName === partName && r.date === todayStr)
          .sort((a, b) => b.shift.localeCompare(a.shift)); // Get latest shift first

        const latestRecordForToday = partRecordsToday[0];
        
        return {
          partName: partName,
          washingPending: latestRecordForToday?.materialInspection.washingPending || 0,
          multigaugePending: latestRecordForToday?.materialInspection.multigaugePending || 0,
        };
      });
      setTodayPendingData(pending);
    }
  }, [records, inspectionLoading]);

  const isLoading = authLoading || inspectionLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading Material Inspection Report...</p>
      </div>
    );
  }

  if (!currentUser && !authLoading) {
     return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold text-foreground">Material Inspection Report</h1>
        <p className="text-muted-foreground">Today's ({format(new Date(), 'PPP')}) pending material for inspection, part-wise.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <SearchCheck className="w-6 h-6" />
            Today's Pending Material
          </CardTitle>
          <CardDescription>
            Shows the latest pending quantities for washing and multigauge inspection from Material Inspection stage for today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayPendingData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Name</TableHead>
                  <TableHead className="text-right">Washing Pending</TableHead>
                  <TableHead className="text-right">Multigauge Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayPendingData.map((item) => (
                  <TableRow key={item.partName}>
                    <TableCell className="font-medium">{item.partName}</TableCell>
                    <TableCell className="text-right">{item.washingPending}</TableCell>
                    <TableCell className="text-right">{item.multigaugePending}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No material inspection data recorded for today, or no pending items.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
