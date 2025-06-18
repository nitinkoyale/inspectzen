
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInspectionData } from '@/hooks/useInspectionData';
import type { PartName, InspectionRecord, Shift, RejectionEntry } from '@/lib/types'; 
import { PART_NAMES_LIST, SHIFT_OPTIONS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package, CheckCircle2, AlertTriangle, Truck, Target, ListTodo, BarChart3, Loader2, MessageSquareShare, Image as ImageIcon, TrendingUp, CalendarIcon, ClipboardCheck, SearchCheck, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart"
import { Bar, XAxis, YAxis, CartesianGrid, Pie, PieChart as RechartsPieChart, Cell, BarChart as RechartsBarChart, Line } from "recharts" 
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NextImage from 'next/image';
import { generateProgressReportImage, type ProgressReportImageInput, type ProgressReportImageOutput } from '@/ai/flows/generate-progress-report-image-flow';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, endOfMonth as dateFnsEndOfMonth, differenceInCalendarDays, startOfDay, endOfDay, subDays } from 'date-fns';
import { cn } from "@/lib/utils";


const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const getRemainingDaysInMonth = (forDate: Date = new Date()): number => {
  const today = startOfDay(forDate);
  const endOfMonthDate = dateFnsEndOfMonth(today);
  const daysRemaining = differenceInCalendarDays(endOfMonthDate, today) + 1;
  return Math.max(1, daysRemaining); // Ensure at least 1 day to avoid division by zero
};


export default function DashboardPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, monthlyTargets, updateMonthlyTarget, isLoading: isInspectionLoading } = useInspectionData();
  const { toast } = useToast();
  
  const [selectedPart, setSelectedPart] = useState<PartName | 'All'>(PART_NAMES_LIST[0]);
  const [partForTargetSetting, setPartForTargetSetting] = useState<PartName>(PART_NAMES_LIST[0]);
  const [targetInputValue, setTargetInputValue] = useState<number>(0);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportImageUrl, setReportImageUrl] = useState<string | null>(null);
  const [whatsAppText, setWhatsAppText] = useState<string>("");
  const [paretoDateRange, setParetoDateRange] = useState<'allTime' | 'last7Days' | 'currentMonth'>('allTime');

  const [reportDateFilter, setReportDateFilter] = useState<Date>(new Date());
  const [reportShiftFilter, setReportShiftFilter] = useState<Shift | 'DayTotal'>('DayTotal');


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (monthlyTargets && partForTargetSetting) {
      setTargetInputValue(monthlyTargets[partForTargetSetting] || 0);
    }
  }, [partForTargetSetting, monthlyTargets]);

  const handleTargetUpdate = useCallback(async () => {
    try {
      await updateMonthlyTarget(partForTargetSetting, targetInputValue);
      toast({ title: "Target Updated", description: `Monthly target for ${partForTargetSetting} set to ${targetInputValue}.`, variant: "default"});
    } catch (error) {
      console.error("Failed to update target", error);
      toast({ title: "Error", description: "Could not update target.", variant: "destructive"});
    }
  }, [partForTargetSetting, targetInputValue, updateMonthlyTarget, toast]);

  const isLoading = authLoading || isInspectionLoading;

  const filteredRecordsForSummary = useMemo(() => {
    if (isLoading) return [];
    return selectedPart === 'All' ? records : records.filter(r => r.partName === selectedPart);
  }, [records, selectedPart, isLoading]);

  const currentTargetToDisplay = useMemo(() => {
    if (isLoading) return 0; 
    if (selectedPart === 'All') {
      return PART_NAMES_LIST.reduce((sum, part) => sum + (monthlyTargets[part] || 0), 0);
    }
    return monthlyTargets[selectedPart] || 0;
  }, [selectedPart, monthlyTargets, isLoading]);

  const totalInspected = useMemo(() => {
    // Total Inspected is based on Final Inspection - Visual Done
    return filteredRecordsForSummary.reduce((sum, r) => sum + r.finalInspection.visual.visualDone, 0);
  }, [filteredRecordsForSummary]);
  
  const totalOkVisual = useMemo(() => {
    // Total OK (Visual) is based on Final Inspection - Visual OK
    return filteredRecordsForSummary.reduce((sum, r) => sum + r.finalInspection.visual.ok, 0);
  }, [filteredRecordsForSummary]);

  const totalNotOk = useMemo(() => {
    // Total Not OK (Visual) is based on Final Inspection - Visual Not OK
    return filteredRecordsForSummary.reduce((sum, r) => sum + r.finalInspection.visual.notOk, 0);
  }, [filteredRecordsForSummary]);

  const totalCumulativeDispatched = useMemo(() => {
    let totalDisp = 0;
    const partsToConsider = selectedPart === 'All' ? PART_NAMES_LIST : [selectedPart];
    partsToConsider.forEach(partName => {
        const partRecords = records.filter(r => r.partName === partName)
                                   .sort((a,b) => {
                                       const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
                                       if (dateDiff !== 0) return dateDiff;
                                       return b.shift.localeCompare(a.shift); 
                                   });
        if (partRecords.length > 0) {
            totalDisp += partRecords[0].dispatch.dispatch.cumulative || 0;
        }
    });
    return totalDisp;
  },[records, selectedPart]);

  const overallProgress = useMemo(() => {
    if (currentTargetToDisplay > 0) {
      return Math.min((totalOkVisual / currentTargetToDisplay) * 100, 100);
    }
    return 0;
  }, [totalOkVisual, currentTargetToDisplay]);


  const remainingDispatchQty = useMemo(() => {
    return totalCumulativeDispatched - totalOkVisual; 
  }, [totalCumulativeDispatched, totalOkVisual]);


  const remainingDays = useMemo(() => getRemainingDaysInMonth(reportDateFilter), [reportDateFilter]);

  const dailyAskingRateRFD = useMemo(() => {
    if (isLoading || remainingDays <= 0) return { rate: 0, isTargetMet: true, needed: 0, forPart: selectedPart };

    let totalTarget = 0;
    let totalCumulativeRfd = 0;
    const partsToConsider = selectedPart === 'All' ? PART_NAMES_LIST : [selectedPart];
    const dayBeforeReportDate = format(subDays(reportDateFilter, 1), 'yyyy-MM-dd');

    partsToConsider.forEach(partName => {
      totalTarget += monthlyTargets[partName] || 0;
      
      const partRecordsUpToYesterday = records
        .filter(r => r.partName === partName && parseISO(r.date).getTime() <= endOfDay(parseISO(dayBeforeReportDate)).getTime())
        .sort((a, b) => {
            const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.shift.localeCompare(a.shift);
        });

      if (partRecordsUpToYesterday.length > 0) {
        totalCumulativeRfd += partRecordsUpToYesterday[0].dispatch.rfd.cumulative || 0;
      }
    });

    const remainingRfdNeeded = totalTarget - totalCumulativeRfd;
    if (remainingRfdNeeded <= 0) return { rate: 0, isTargetMet: true, needed: remainingRfdNeeded, forPart: selectedPart };

    return { rate: Math.ceil(remainingRfdNeeded / remainingDays), isTargetMet: false, needed: remainingRfdNeeded, forPart: selectedPart };
  }, [selectedPart, monthlyTargets, records, isLoading, remainingDays, reportDateFilter]);


  const inspectionStatusData = useMemo(() => {
    const other = Math.max(0, totalInspected - totalOkVisual - totalNotOk);
    return [ 
        { name: 'OK (Visual)', value: totalOkVisual, fill: "hsl(var(--chart-1))" },
        { name: 'Not OK (Visual)', value: totalNotOk, fill: "hsl(var(--chart-2))" },
        { name: 'Pending/Other (Visual)', value: other, fill: "hsl(var(--chart-3))" },
    ]
  }, [totalOkVisual, totalNotOk, totalInspected]);
  
  const dispatchByPartData = useMemo(() => {
    if (isLoading) return [];
    return PART_NAMES_LIST.map(part => {
        const partRecords = records.filter(r => r.partName === part)
                                 .sort((a,b) => {
                                     const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
                                     if (dateDiff !== 0) return dateDiff;
                                     return b.shift.localeCompare(a.shift);
                                 });
        return {
            name: part,
            dispatched: partRecords.length > 0 ? (partRecords[0].dispatch.dispatch.cumulative || 0) : 0,
        };
    })
  }, [records, isLoading]);

  const paretoData = useMemo(() => {
    if (isLoading || records.length === 0) return [];
    
    let filteredForParetoRecords = records;
    const today = startOfDay(new Date());

    if (paretoDateRange === 'last7Days') {
      const sevenDaysAgo = startOfDay(subDays(today, 6));
      filteredForParetoRecords = records.filter(r => {
        const recordDate = startOfDay(parseISO(r.date));
        return recordDate >= sevenDaysAgo && recordDate <= today;
      });
    } else if (paretoDateRange === 'currentMonth') {
      const firstDayOfMonth = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
      filteredForParetoRecords = records.filter(r => {
        const recordDate = startOfDay(parseISO(r.date));
        return recordDate >= firstDayOfMonth && recordDate <= today;
      });
    }

    const rejectionsByDefectType: Record<string, number> = {};

    filteredForParetoRecords.forEach(record => {
      (record.rejections || []).forEach(rej => {
        rejectionsByDefectType[rej.defectType] = (rejectionsByDefectType[rej.defectType] || 0) + rej.quantity;
      });
      (record.tpiRejections || []).forEach(rej => {
        rejectionsByDefectType[rej.defectType] = (rejectionsByDefectType[rej.defectType] || 0) + rej.quantity;
      });
    });

    const totalAllDefectRejections = Object.values(rejectionsByDefectType).reduce((sum, count) => sum + count, 0);

    if (totalAllDefectRejections === 0) return [];

    const defectRejectionDetails = Object.entries(rejectionsByDefectType)
      .map(([defect, quantity]) => ({
        name: defect, // name is now defect type
        rejections: quantity,
        percentage: totalAllDefectRejections > 0 ? (quantity / totalAllDefectRejections) * 100 : 0,
      }))
      .filter(detail => detail.rejections > 0);

    defectRejectionDetails.sort((a, b) => b.rejections - a.rejections);

    let cumulativePercentage = 0;
    const chartData = defectRejectionDetails.map(detail => {
      cumulativePercentage += detail.percentage;
      return {
        ...detail,
        cumulativePercentage: Math.min(cumulativePercentage, 100),
      };
    });

    return chartData;
  }, [records, isLoading, paretoDateRange]);

  const paretoChartConfig = useMemo(() => ({
    rejections: { label: 'Rejections', color: "hsl(var(--chart-1))" },
    cumulativePercentage: { label: 'Cumulative %', color: "hsl(var(--chart-2))" },
  }), []) satisfies ChartConfig;

  const handleGenerateWhatsAppReport = useCallback(async () => {
    setIsGeneratingReport(true);
    setReportImageUrl(null);
    setWhatsAppText("");
    const selectedReportDateStr = format(reportDateFilter, 'yyyy-MM-dd');
    const endOfSelectedReportDay = endOfDay(parseISO(selectedReportDateStr));

    const calculateDailyAskingRateForPart = (
        partName: PartName,
        targetDate: Date,
        allRecords: InspectionRecord[],
        targets: Record<PartName, number>
    ): { rate: number; isTargetMet: boolean; needed: number; days: number } => {
        const remainingDays = getRemainingDaysInMonth(targetDate);
        if (remainingDays <= 0) return { rate: 0, isTargetMet: false, needed: 0, days: 0 };

        const partTarget = targets[partName] || 0;
        if (partTarget === 0) return { rate: 0, isTargetMet: false, needed: 0, days: remainingDays };

        const dayBeforeTargetDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
        let cumulativeRfdUpToYesterday = 0;

        const partRecordsUpToYesterday = allRecords
            .filter(r => r.partName === partName && parseISO(r.date).getTime() <= endOfDay(parseISO(dayBeforeTargetDate)).getTime())
            .sort((a, b) => {
                const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                const shiftOrder = {'B': 1, 'A': 0} as Record<Shift, number>;
                return (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0);
            });

        if (partRecordsUpToYesterday.length > 0) {
            cumulativeRfdUpToYesterday = partRecordsUpToYesterday[0].dispatch.rfd.cumulative || 0;
        }

        const remainingRfdNeeded = partTarget - cumulativeRfdUpToYesterday;
        if (remainingRfdNeeded <= 0) return { rate: 0, isTargetMet: true, needed: remainingRfdNeeded, days: remainingDays };

        return { rate: Math.ceil(remainingRfdNeeded / remainingDays), isTargetMet: false, needed: remainingRfdNeeded, days: remainingDays };
    };

    try {
      let textReport = `VINFAST Inspection Report - ${format(reportDateFilter, 'PPP')}\n`;
      textReport += `====================================\n\n`;
      
      const partsProgressForImage: ProgressReportImageInput['partsProgress'] = [];

      for (const partName of PART_NAMES_LIST) {
        textReport += `${partName.toUpperCase()}\n`;
        textReport += `--------------------\n`;
        textReport += `Target (Month OK Parts): ${monthlyTargets[partName] || 0}\n`;

        const allRecordsForPartUpToSelectedDate = records
            .filter(r => r.partName === partName && parseISO(r.date).getTime() <= endOfSelectedReportDay.getTime());

        const sortedRecordsForCumulative = [...allRecordsForPartUpToSelectedDate].sort((a, b) => {
            const dateDiff = parseISO(b.date).getTime() - parseISO(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            const shiftOrder = {'B': 1, 'A': 0} as Record<Shift, number>;
            return (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0);
        });
        
        const latestRecordDataForCumulativeAndPending = sortedRecordsForCumulative.length > 0 ? sortedRecordsForCumulative[0] : null;
        const cumulativeRFDPart = latestRecordDataForCumulativeAndPending?.dispatch.rfd.cumulative || 0;
        const cumulativeDispatchedPart = latestRecordDataForCumulativeAndPending?.dispatch.dispatch.cumulative || 0;
        
        textReport += `Cumulative RFD (as of ${format(reportDateFilter, 'dd/MM')}): ${cumulativeRFDPart}\n`;
        textReport += `Cumulative Dispatch (as of ${format(reportDateFilter, 'dd/MM')}): ${cumulativeDispatchedPart}\n`;

        const askingRateData = calculateDailyAskingRateForPart(partName, reportDateFilter, records, monthlyTargets);
        if (askingRateData.isTargetMet) {
            textReport += `Daily Asking Rate (RFD): Target Met!`;
            if(askingRateData.needed < 0) textReport += ` (Surplus ${-askingRateData.needed})`;
            textReport += `\n\n`;
        } else {
            textReport += `Daily Asking Rate (RFD): ${askingRateData.rate} units/day (Need ${askingRateData.needed} more in ${askingRateData.days} days)\n\n`;
        }
        
        const shiftLabel = reportShiftFilter === 'DayTotal' ? 'Daily Summary' : `Shift ${reportShiftFilter} Summary`;
        textReport += `${shiftLabel} (for ${format(reportDateFilter, 'PPP')}):\n`;
        
        const partRecordsForSelectedDate = records.filter(r => r.partName === partName && r.date === selectedReportDateStr);
        
        let dailyMultigaugeTotal = 0, dailyMultigaugeOk = 0, dailyMultigaugeNotOk = 0;
        let dailyVisualDone = 0, dailyVisualOk = 0, dailyVisualNotOk = 0;
        let dailyFinalInspRejections: RejectionEntry[] = [];
        let dailyTpiDone = 0, dailyTpiOk = 0, dailyTpiNotOk = 0;
        let dailyTpiInspRejections: RejectionEntry[] = [];
        let dailyRFDToday = 0, dailyDispatchToday = 0;

        if (reportShiftFilter === 'DayTotal') {
          partRecordsForSelectedDate.forEach(rec => {
            dailyMultigaugeTotal += (rec.finalInspection.multigauge.total || 0);
            dailyMultigaugeOk += (rec.finalInspection.multigauge.ok || 0);
            dailyMultigaugeNotOk += (rec.finalInspection.multigauge.notOk || 0);

            dailyVisualDone += (rec.finalInspection.visual.visualDone || 0);
            dailyVisualOk += (rec.finalInspection.visual.ok || 0);
            dailyVisualNotOk += (rec.finalInspection.visual.notOk || 0);
            if (rec.rejections) dailyFinalInspRejections.push(...rec.rejections);

            dailyTpiDone += rec.tpiInspection.done || 0;
            dailyTpiOk += rec.tpiInspection.ok || 0;
            dailyTpiNotOk += rec.tpiInspection.notOk || 0;
            if (rec.tpiRejections) dailyTpiInspRejections.push(...rec.tpiRejections);
            
            dailyRFDToday += rec.dispatch.rfd.today || 0;
            dailyDispatchToday += rec.dispatch.dispatch.today || 0;
          });
        } else {
          const shiftRecord = partRecordsForSelectedDate.find(r => r.shift === reportShiftFilter);
          if (shiftRecord) {
            dailyMultigaugeTotal = (shiftRecord.finalInspection.multigauge.total || 0);
            dailyMultigaugeOk = (shiftRecord.finalInspection.multigauge.ok || 0);
            dailyMultigaugeNotOk = (shiftRecord.finalInspection.multigauge.notOk || 0);

            dailyVisualDone = (shiftRecord.finalInspection.visual.visualDone || 0);
            dailyVisualOk = (shiftRecord.finalInspection.visual.ok || 0);
            dailyVisualNotOk = (shiftRecord.finalInspection.visual.notOk || 0);
            dailyFinalInspRejections = shiftRecord.rejections || [];

            dailyTpiDone = shiftRecord.tpiInspection.done || 0;
            dailyTpiOk = shiftRecord.tpiInspection.ok || 0;
            dailyTpiNotOk = shiftRecord.tpiInspection.notOk || 0;
            dailyTpiInspRejections = shiftRecord.tpiRejections || [];

            dailyRFDToday = shiftRecord.dispatch.rfd.today || 0;
            dailyDispatchToday = shiftRecord.dispatch.dispatch.today || 0;
          }
        }
        
        textReport += `  Multigauge Insp:\n`;
        textReport += `    Total Inspected: ${dailyMultigaugeTotal}\n`;
        textReport += `    OK: ${dailyMultigaugeOk}\n`;
        textReport += `    Not OK: ${dailyMultigaugeNotOk}\n`;

        textReport += `  Visual Insp:\n`;
        textReport += `    Visual Done: ${dailyVisualDone}\n`;
        textReport += `    OK: ${dailyVisualOk}\n`;
        textReport += `    Not OK: ${dailyVisualNotOk}\n`;
        if (dailyFinalInspRejections.length > 0) {
            textReport += `    Rejections (Final Visual Insp.):\n`;
            const uniqueDefects: Record<string, number> = {};
            dailyFinalInspRejections.forEach(rej => {
                uniqueDefects[rej.defectType] = (uniqueDefects[rej.defectType] || 0) + rej.quantity;
            });
            Object.entries(uniqueDefects).forEach(([defect, qty]) => {
                 textReport += `      - ${defect}: ${qty}\n`;
            });
        }

        textReport += `  TPI Insp:\n`;
        textReport += `    Done: ${dailyTpiDone}\n`;
        textReport += `    OK: ${dailyTpiOk}\n`;
        textReport += `    Not OK: ${dailyTpiNotOk}\n`;
        if (dailyTpiInspRejections.length > 0) {
            textReport += `    Rejections (TPI):\n`;
            const uniqueTpiDefects: Record<string, number> = {};
            dailyTpiInspRejections.forEach(rej => {
                uniqueTpiDefects[rej.defectType] = (uniqueTpiDefects[rej.defectType] || 0) + rej.quantity;
            });
            Object.entries(uniqueTpiDefects).forEach(([defect, qty]) => {
                 textReport += `      - ${defect}: ${qty}\n`;
            });
        }
        
        textReport += `  Dispatch (Today):\n`;
        textReport += `    RFD: ${dailyRFDToday}\n`;
        textReport += `    Dispatched: ${dailyDispatchToday}\n\n`;

        const washingPending = latestRecordDataForCumulativeAndPending?.materialInspection.washingPending || 0;
        const multigaugePendingMaterial = latestRecordDataForCumulativeAndPending?.materialInspection.multigaugePending || 0;
        const visualPendingFinal = latestRecordDataForCumulativeAndPending?.finalInspection.visual.pending || 0;
        const tpiPending = latestRecordDataForCumulativeAndPending?.tpiInspection.pending || 0;

        textReport += `Inspection Pending (as of end of ${format(reportDateFilter, 'PPP')}):\n`;
        textReport += `  Washing Pending: ${washingPending}\n`;
        textReport += `  Multigauge Pending (Mat.Insp): ${multigaugePendingMaterial}\n`;
        textReport += `  Visual Pending (Final Insp.): ${visualPendingFinal}\n`;
        textReport += `  TPI Pending: ${tpiPending}\n\n\n`;
        
        let cumulativeVisualOkForPart = 0;
        let cumulativeVisualInspectedForPart = 0; // This should be based on Visual Done
        allRecordsForPartUpToSelectedDate.forEach(rec => {
            cumulativeVisualOkForPart += (rec.finalInspection.visual.ok || 0);
            cumulativeVisualInspectedForPart += (rec.finalInspection.visual.visualDone || 0);
        });

        partsProgressForImage.push({
          name: partName,
          target: monthlyTargets[partName] || 0,
          inspected: cumulativeVisualInspectedForPart, // Based on Visual Done
          ok: cumulativeVisualOkForPart, // Based on Visual OK
        });
      }
      textReport += "Please see attached image for a visual summary of progress against targets.";
      setWhatsAppText(textReport);

      const imageInput: ProgressReportImageInput = { partsProgress: partsProgressForImage, reportDate: selectedReportDateStr };
      const imageResult = await generateProgressReportImage(imageInput);
      setReportImageUrl(imageResult.imageDataUri);

      toast({ title: "Report Generated", description: "Text and image ready for WhatsApp.", variant: "default" });

    } catch (error) {
      console.error("Error generating WhatsApp report:", error);
      toast({ title: "Report Generation Failed", description: `Could not generate the report: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [records, reportDateFilter, reportShiftFilter, monthlyTargets, toast]);


  if (isLoading) {
    return <div className="container mx-auto py-8 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading dashboard data...</p></div>;
  }
  if (!currentUser && !authLoading) { 
    return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to view the dashboard.</p></div>;
  }


  return (
    <div className="container mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold text-foreground">Inspection Dashboard</h1>
        <p className="text-muted-foreground">Monthly overview of inspection activities.</p>
      </header>

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Target className="w-6 h-6" />
            Monthly Target (OK Parts)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
          <div className="md:col-span-1">
            <Label htmlFor="partForTarget">Select Part</Label>
            <Select value={partForTargetSetting} onValueChange={(value) => setPartForTargetSetting(value as PartName)}>
              <SelectTrigger id="partForTarget" className="mt-1">
                <SelectValue placeholder="Select Part" />
              </SelectTrigger>
              <SelectContent>
                {PART_NAMES_LIST.map(part => (
                  <SelectItem key={part} value={part}>{part}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="monthlyTargetInput" className="text-sm font-medium">Set Target for {partForTargetSetting}</Label>
            <Input
              id="monthlyTargetInput"
              type="number"
              value={targetInputValue}
              onChange={(e) => setTargetInputValue(parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0)}
              min="0"
              className="mt-1"
              placeholder="Enter target"
            />
          </div>
          <Button onClick={handleTargetUpdate} className="md:col-span-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            Update Target
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent">
            <MessageSquareShare className="w-6 h-6" />
            Generate WhatsApp Report
          </CardTitle>
          <CardDescription>Create a text summary and a visual progress image to share on WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
                <Label htmlFor="reportDateFilter">Report Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="reportDateFilter"
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal mt-1",!reportDateFilter && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reportDateFilter ? format(reportDateFilter, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={reportDateFilter} onSelect={(date) => date && setReportDateFilter(date)} initialFocus />
                    </PopoverContent>
                </Popover>
            </div>
            <div>
                <Label htmlFor="reportShiftFilter">Report Shift</Label>
                <Select value={reportShiftFilter} onValueChange={(value) => setReportShiftFilter(value as Shift | 'DayTotal')}>
                    <SelectTrigger id="reportShiftFilter" className="mt-1">
                        <SelectValue placeholder="Select Shift"/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="DayTotal">Day Total (All Shifts)</SelectItem>
                        {SHIFT_OPTIONS.map(shift => <SelectItem key={shift} value={shift}>Shift {shift}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <Button onClick={handleGenerateWhatsAppReport} disabled={isGeneratingReport} className="w-full sm:w-auto">
            {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            {isGeneratingReport ? "Generating Report..." : "Generate Report & Image"}
          </Button>
          {reportImageUrl && (
            <div className="mt-4 p-4 border rounded-md bg-secondary/30">
              <h4 className="font-semibold text-lg mb-2 text-secondary-foreground">Generated Progress Image:</h4>
              <NextImage src={reportImageUrl} alt="Progress Report" width={600} height={400} className="rounded-md shadow-md border" data-ai-hint="progress report chart"/>
              <p className="text-sm text-muted-foreground mt-2">Save this image or take a screenshot to attach to your WhatsApp message.</p>
            </div>
          )}
          {whatsAppText && (
            <div className="mt-4 p-4 border rounded-md bg-secondary/30">
              <h4 className="font-semibold text-lg mb-2 text-secondary-foreground">Formatted Text Report:</h4>
              <pre className="whitespace-pre-wrap text-sm bg-background p-3 rounded-md shadow-inner">{whatsAppText}</pre>
              <Button 
                asChild 
                className="mt-3 bg-green-500 hover:bg-green-600 text-white"
                disabled={!whatsAppText}
              >
                <a 
                  href={`whatsapp://send?text=${encodeURIComponent(whatsAppText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share Text on WhatsApp
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Ensure you have WhatsApp Desktop installed or are on a mobile device. Remember to manually attach the generated image above.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mb-6">
        <Label htmlFor="partFilterSummary">Filter by Part (for summary cards &amp; charts below)</Label>
        <Select value={selectedPart} onValueChange={(value) => setSelectedPart(value as PartName | 'All')}>
          <SelectTrigger id="partFilterSummary" className="w-full sm:w-[280px] mt-1">
            <SelectValue placeholder="Select Part" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Parts</SelectItem>
            {PART_NAMES_LIST.map(part => (
              <SelectItem key={part} value={part}>{part}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Inspected (Visual)</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalInspected}</div>
            <p className="text-xs text-muted-foreground">{selectedPart === 'All' ? 'Across all parts (all time)' : `For ${selectedPart} (all time)`}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total OK (Visual)</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold text-foreground">{totalOkVisual}</div>
             <p className="text-xs text-muted-foreground">Target: {currentTargetToDisplay > 0 ? currentTargetToDisplay : 'Not set'}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Not OK (Visual)</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalNotOk}</div>
            {totalInspected > 0 && (
              <p className="text-xs text-muted-foreground">{((totalNotOk / totalInspected) * 100).toFixed(1)}% rejection rate</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Dispatched</CardTitle>
            <Truck className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalCumulativeDispatched}</div>
            <p className="text-xs text-muted-foreground">Cumulative for {selectedPart === 'All' ? 'all parts' : selectedPart}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatch vs Target (Visual OK)</CardTitle>
            <ListTodo className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${remainingDispatchQty >= 0 ? 'text-green-600' : 'text-orange-500'}`}>{remainingDispatchQty >=0 ? `+${remainingDispatchQty}` : remainingDispatchQty}</div>
            <p className="text-xs text-muted-foreground">
              {remainingDispatchQty >= 0 ? 'Surplus over Visual OK parts' : 'Short of Visual OK parts'}
            </p>
          </CardContent>
        </Card>
         <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily RFD Asking Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground pb-1">For month from: {format(reportDateFilter, 'PPP')}</p>
            {dailyAskingRateRFD.isTargetMet ? (
              <>
                <div className="text-2xl font-bold text-green-600">Target Met!</div>
                {dailyAskingRateRFD.needed < 0 && <p className="text-xs text-muted-foreground">Surplus of {-dailyAskingRateRFD.needed} RFD units.</p>}
                 <p className="text-xs text-muted-foreground">For {dailyAskingRateRFD.forPart === 'All' ? 'all parts combined' : dailyAskingRateRFD.forPart}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">{dailyAskingRateRFD.rate}</div>
                <p className="text-xs text-muted-foreground">
                  units/day for {dailyAskingRateRFD.forPart === 'All' ? 'all parts combined' : dailyAskingRateRFD.forPart}
                </p>
                <p className="text-xs text-muted-foreground">({dailyAskingRateRFD.needed} more RFD needed in {remainingDays} days)</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {currentTargetToDisplay > 0 && (
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Overall Progress Towards Target (Visual OK Parts - All Time)</CardTitle>
            <CardDescription>{selectedPart === 'All' ? 'Across all parts towards combined target' : `For ${selectedPart} towards its target`}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="w-full h-4" />
            <p className="text-right mt-2 text-sm font-medium text-foreground">{overallProgress.toFixed(1)}%</p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Defect-wise Rejection Pareto Analysis
          </CardTitle>
          <CardDescription>Cumulative rejection percentage by defect type (from logged defect entries - Final &amp; TPI)</CardDescription>
          <div className="pt-2">
            <Label htmlFor="paretoFilterRange" className="text-sm">Date Range</Label>
            <Select value={paretoDateRange} onValueChange={(value) => setParetoDateRange(value as any)}>
              <SelectTrigger id="paretoFilterRange" className="w-full sm:w-[200px] mt-1">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allTime">All Time</SelectItem>
                <SelectItem value="last7Days">Last 7 Days</SelectItem>
                <SelectItem value="currentMonth">Current Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {paretoData.length > 0 ? (
            <ChartContainer config={paretoChartConfig} className="min-h-[400px] w-full">
              <RechartsBarChart data={paretoData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70} 
                  interval={0} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                />
                <YAxis 
                  yAxisId="left" 
                  orientation="left" 
                  stroke="hsl(var(--chart-1))" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  label={{ value: 'Rejection Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }, offset: -10 }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="hsl(var(--chart-2))" 
                  domain={[0, 100]} 
                  tickFormatter={(value) => `${value.toFixed(0)}%`} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }, offset: -5 }}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  content={<ChartTooltipContent indicator="dashed" 
                    formatter={(value, name, item) => {
                      if (item.dataKey === 'cumulativePercentage') {
                        return `${Number(value).toFixed(1)}%`;
                      }
                      return Number(value).toLocaleString();
                    }}
                  />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="left" dataKey="rejections" name="Rejections" radius={[4, 4, 0, 0]}>
                   {paretoData.map((entry, index) => (
                      <Cell key={`cell-pareto-${index}`} fill={CHART_COLORS[0]} />
                    ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative %" strokeWidth={2} stroke="hsl(var(--chart-2))" dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{r: 6}}/>
              </RechartsBarChart>
            </ChartContainer>
          ) : (
            <p className="text-center text-muted-foreground py-4">No rejection data available for the selected range to display Pareto chart.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Inspection Status Overview (All Time)</CardTitle>
             <CardDescription>{selectedPart === 'All' ? 'Across all parts (Final Insp. Visual - OK vs Not OK)' : `For ${selectedPart} (Final Insp. Visual - OK vs Not OK)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="min-h-[300px] w-full">
               <RechartsPieChart>
                <Pie data={inspectionStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {inspectionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <ChartLegend content={<ChartLegendContent />} />
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Cumulative Dispatch by Part (All Time)</CardTitle>
             <CardDescription>Total dispatched units for each part type</CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer config={{dispatched: {label: "Dispatched", color: "hsl(var(--chart-1))"}}} className="min-h-[300px] w-full">
              <RechartsBarChart data={dispatchByPartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" hideLabel />}
                />
                <Bar dataKey="dispatched" radius={4}>
                   {dispatchByPartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                </Bar>
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

