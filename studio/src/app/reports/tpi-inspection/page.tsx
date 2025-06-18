
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useInspectionData } from '@/hooks/useInspectionData';
import type { PartName, InspectionRecord, RejectionEntry } from '@/lib/types';
import { PART_NAMES_LIST } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, CalendarIcon, BarChart3, Search, PackageIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Cell, BarChart as RechartsBarChart, Line } from "recharts";
import { format, parseISO, startOfDay, endOfDay, subDays, addDays, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface TodayPendingTpi {
  partName: PartName;
  tpiPending: number;
}

interface TpiAggregateStats {
  totalDone: number;
  totalOk: number;
  totalRejected: number;
}

interface TpiParetoDataPoint {
  name: PartName | string; // Can be PartName or defect type if we enhance later
  rejections: number;
  percentage: number;
  cumulativePercentage: number;
}

export default function TpiInspectionReportPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, isLoading: inspectionLoading } = useInspectionData();
  
  const [todayPendingData, setTodayPendingData] = useState<TodayPendingTpi[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6), 
    to: new Date(),
  });
  const [selectedPartForRange, setSelectedPartForRange] = useState<PartName | 'All'>('All');
  const [aggregateStats, setAggregateStats] = useState<TpiAggregateStats>({ totalDone: 0, totalOk: 0, totalRejected: 0 });
  const [paretoData, setParetoData] = useState<TpiParetoDataPoint[]>([]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!inspectionLoading && records.length > 0) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const pending: TodayPendingTpi[] = PART_NAMES_LIST.map(partName => {
        const partRecordsToday = records
          .filter(r => r.partName === partName && r.date === todayStr)
          .sort((a, b) => b.shift.localeCompare(a.shift));
        const latestRecordForToday = partRecordsToday[0];
        return {
          partName: partName,
          tpiPending: latestRecordForToday?.tpiInspection.pending || 0,
        };
      });
      setTodayPendingData(pending);
    }
  }, [records, inspectionLoading]);

  useEffect(() => {
    if (!inspectionLoading && records.length > 0 && dateRange?.from && dateRange?.to) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = endOfDay(dateRange.to);

      const dateFilteredRecords = records.filter(r => {
        const recordDate = parseISO(r.date);
        return recordDate >= fromDate && recordDate <= toDate;
      });

      const partAndDateFilteredRecords = selectedPartForRange === 'All' 
        ? dateFilteredRecords
        : dateFilteredRecords.filter(r => r.partName === selectedPartForRange);

      let totalDone = 0;
      let totalOk = 0;
      let totalRejected = 0;
      
      const partsToConsiderForPareto = selectedPartForRange === 'All' ? PART_NAMES_LIST : [selectedPartForRange];
      const rejectionsByPart: Record<PartName, number> = partsToConsiderForPareto.reduce((acc, pn) => ({ ...acc, [pn]: 0 }), {} as Record<PartName, number>);

      partAndDateFilteredRecords.forEach(r => {
        totalDone += r.tpiInspection.done || 0;
        totalOk += r.tpiInspection.ok || 0;
        const currentRecordRejections = r.tpiRejections?.reduce((sum, rej) => sum + rej.quantity, 0) || 0;
        totalRejected += currentRecordRejections;
        
        if (rejectionsByPart[r.partName] !== undefined) { // This check ensures we only add to parts we are considering for pareto
            rejectionsByPart[r.partName] += currentRecordRejections;
        }
      });
      setAggregateStats({ totalDone, totalOk, totalRejected });

      const totalAllTpiRejectionsForPareto = Object.values(rejectionsByPart).reduce((sum, count) => sum + count, 0);
      
      if (totalAllTpiRejectionsForPareto > 0) {
        const partRejectionDetails = partsToConsiderForPareto.map(partName => ({
          name: partName,
          rejections: rejectionsByPart[partName] || 0,
          percentage: totalAllTpiRejectionsForPareto > 0 ? ((rejectionsByPart[partName] || 0) / totalAllTpiRejectionsForPareto) * 100 : 0,
        })).filter(detail => detail.rejections > 0);

        partRejectionDetails.sort((a, b) => b.rejections - a.rejections);

        let cumulativePercentage = 0;
        const chartData = partRejectionDetails.map(detail => {
          cumulativePercentage += detail.percentage;
          return {
            ...detail,
            cumulativePercentage: Math.min(cumulativePercentage, 100),
          };
        });
        setParetoData(chartData);
      } else {
        setParetoData([]);
      }
    } else if (!inspectionLoading) {
      setAggregateStats({ totalDone: 0, totalOk: 0, totalRejected: 0 });
      setParetoData([]);
    }
  }, [records, inspectionLoading, dateRange, selectedPartForRange]);

  const paretoChartConfig = useMemo(() => ({
    rejections: { label: 'TPI Rejections', color: "hsl(var(--chart-1))" },
    cumulativePercentage: { label: 'Cumulative %', color: "hsl(var(--chart-2))" },
  }), []) satisfies ChartConfig;

  const isLoading = authLoading || inspectionLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg">Loading TPI Inspection Report...</p>
      </div>
    );
  }
  
  if (!currentUser && !authLoading) {
     return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to view reports.</p></div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold text-foreground">TPI Inspection Report</h1>
        <p className="text-muted-foreground">Analysis of Third Party Inspection activities and rejections.</p>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-6 h-6" />
            Today's TPI Pending Material
          </CardTitle>
          <CardDescription>
            Current TPI pending quantities as of {format(new Date(), 'PPP')}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayPendingData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Name</TableHead>
                  <TableHead className="text-right">TPI Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayPendingData.map((item) => (
                  <TableRow key={item.partName}>
                    <TableCell className="font-medium">{item.partName}</TableCell>
                    <TableCell className="text-right">{item.tpiPending}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No TPI data recorded for today, or no pending items.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Search className="w-6 h-6" />
            TPI Performance Analysis
          </CardTitle>
          <CardDescription>
            Select a date range and part to analyze cumulative TPI data and rejection patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="date-range-picker">Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-range-picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="part-filter-range">Select Part</Label>
              <Select value={selectedPartForRange} onValueChange={(value) => setSelectedPartForRange(value as PartName | 'All')}>
                <SelectTrigger id="part-filter-range" className="w-full mt-1">
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
          </div>

          {dateRange?.from && dateRange?.to ? (
            <>
              <h3 className="text-lg font-semibold pt-4">
                Cumulative TPI Statistics for {selectedPartForRange === 'All' ? 'All Parts' : selectedPartForRange}
                <span className="text-base font-normal text-muted-foreground"> ({format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")})</span>
              </h3>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Total TPI Done</TableCell>
                    <TableCell className="text-right">{aggregateStats.totalDone.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total TPI OK</TableCell>
                    <TableCell className="text-right">{aggregateStats.totalOk.toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-destructive">Total TPI Rejections</TableCell>
                    <TableCell className="text-right text-destructive">{aggregateStats.totalRejected.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <h3 className="text-lg font-semibold pt-6">TPI Rejection Pareto Analysis ({selectedPartForRange === 'All' ? 'All Parts' : selectedPartForRange})</h3>
              {paretoData.length > 0 ? (
                <ChartContainer config={paretoChartConfig} className="min-h-[400px] w-full">
                  <RechartsBarChart data={paretoData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                    <XAxis 
                      dataKey="name" 
                      angle={selectedPartForRange === 'All' ? -45 : 0}
                      textAnchor={selectedPartForRange === 'All' ? "end" : "middle"}
                      height={selectedPartForRange === 'All' ? 70 : 30}
                      interval={0} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      stroke="hsl(var(--chart-1))" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      label={{ value: 'TPI Rejection Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }, offset: -10 }}
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
                    <Bar yAxisId="left" dataKey="rejections" name="TPI Rejections" radius={[4, 4, 0, 0]}>
                       {paretoData.map((entry, index) => (
                          <Cell key={`cell-tpi-pareto-${index}`} fill={CHART_COLORS[0]} />
                        ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative %" strokeWidth={2} stroke="hsl(var(--chart-2))" dot={{ r: 4, fill: "hsl(var(--chart-2))" }} activeDot={{r: 6}}/>
                  </RechartsBarChart>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-4">No TPI rejection data available for the selected part and date range to display Pareto chart.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">Please select a date range to view TPI statistics and Pareto chart.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

