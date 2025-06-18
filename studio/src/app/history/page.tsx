
"use client";

import { useInspectionData } from '@/hooks/useInspectionData';
import type { InspectionRecord, PartName, Shift } from '@/lib/types';
import { PART_NAMES_LIST, SHIFT_OPTIONS } from '@/lib/constants';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Eye, Edit2, Loader2 } from "lucide-react"; 
import { format, parseISO } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function HistoryPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { records, deleteRecord, isLoading: isInspectionLoading } = useInspectionData();
  const [showDetails, setShowDetails] = useState<InspectionRecord | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  const handleDelete = useCallback(async (recordId: string, partName: PartName, recordDate: string, shift: Shift) => {
    try {
      await deleteRecord(recordId);
      toast({ title: "Record Deleted", description: `Inspection record for ${partName} (Shift ${shift}) on ${format(parseISO(recordDate), 'PPP')} has been deleted.`, variant: "default" });
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({ title: "Error Deleting Record", description: "Could not delete the record. Please try again.", variant: "destructive"});
    }
  }, [deleteRecord, toast]);
  
  const handleEdit = useCallback((record: InspectionRecord) => {
    toast({ title: "Edit Record", description: `Navigating to edit record for ${record.partName} (Shift ${record.shift}) on ${format(parseISO(record.date), 'PPP')}. The form will auto-load the data.`, variant: "default" });
    router.push(`/data-entry?date=${record.date}&partName=${record.partName}&shift=${record.shift}`); 
  }, [router, toast]);

  const isLoading = authLoading || isInspectionLoading;

  if (isLoading) {
    return <div className="container mx-auto py-8 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading history...</p></div>;
  }

  if (!currentUser && !authLoading) { 
    return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to view history.</p></div>;
  }
  
  if (!isLoading && records.length === 0) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-3xl font-bold font-headline mb-2 text-foreground">Inspection History</h1>
        <p className="text-muted-foreground">No inspection records found.</p>
        <Button onClick={() => router.push('/data-entry')} className="mt-4">Add New Record</Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold font-headline mb-2 text-foreground">Inspection History</h1>
      <p className="text-muted-foreground mb-8">View all previously entered inspection data.</p>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">All Records</CardTitle>
          <CardDescription>A complete log of all inspection activities, ordered by most recent.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Material Insp. (Wash/Multi)</TableHead>
                  <TableHead>Final Insp. (Multi OK/Visual OK)</TableHead>
                  <TableHead>TPI (Done/OK)</TableHead>
                  <TableHead>Dispatch (RFD Today/Disp. Today)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(parseISO(record.date), 'PPP')}</TableCell>
                    <TableCell>{record.shift}</TableCell>
                    <TableCell>{record.partName}</TableCell>
                    <TableCell>{record.materialInspection.washingPending} / {record.materialInspection.multigaugePending}</TableCell>
                    <TableCell>{record.finalInspection.multigauge.ok} / {record.finalInspection.visual.ok}</TableCell>
                    <TableCell>{record.tpiInspection.done} / {record.tpiInspection.ok}</TableCell>
                    <TableCell>{record.dispatch.rfd.today} / {record.dispatch.dispatch.today}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} title="Edit Record">
                        <Edit2 className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setShowDetails(record)} title="View Details">
                        <Eye className="h-4 w-4 text-gray-500" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Delete Record">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the inspection record for <span className="font-semibold">{record.partName}</span> (Shift <span className="font-semibold">{record.shift}</span>) on <span className="font-semibold">{format(parseISO(record.date), 'PPP')}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(record.id, record.partName, record.date, record.shift)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
           {records.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-4">No records to display.</p>}
        </CardContent>
      </Card>

      {showDetails && (
        <AlertDialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Inspection Details: {showDetails.partName} - Shift {showDetails.shift} - {format(parseISO(showDetails.date), 'PPP')}</AlertDialogTitle>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 text-sm py-4">
                <div><strong>ID:</strong> {showDetails.id}</div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-primary">Material Inspection</h4>
                  <p>Washing Pending: {showDetails.materialInspection.washingPending}</p>
                  <p>Multigauge Pending: {showDetails.materialInspection.multigaugePending}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-primary">Final Inspection</h4>
                  <p className="font-medium">Multigauge:</p>
                  <ul className="list-disc list-inside ml-4">
                    <li>Total: {showDetails.finalInspection.multigauge.total}</li>
                    <li>OK: {showDetails.finalInspection.multigauge.ok}</li>
                    <li>Not OK: {showDetails.finalInspection.multigauge.notOk}</li>
                  </ul>
                  <p className="font-medium mt-2">Visual:</p>
                  <ul className="list-disc list-inside ml-4">
                    <li>Pending: {showDetails.finalInspection.visual.pending}</li>
                    <li>Visual Done: {showDetails.finalInspection.visual.visualDone}</li>
                    <li>OK: {showDetails.finalInspection.visual.ok}</li>
                    <li>Not OK: {showDetails.finalInspection.visual.notOk}</li>
                  </ul>
                </div>
                 {showDetails.rejections && showDetails.rejections.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-primary">Final Inspection - Rejection Details</h4>
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead>Defect</TableHead><TableHead>Qty</TableHead><TableHead>Remarks</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {showDetails.rejections.map((rej, i) => <TableRow key={`fin-rej-${i}`}><TableCell>{rej.defectType}</TableCell><TableCell>{rej.quantity}</TableCell><TableCell>{rej.remarks || '-'}</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <h4 className="font-semibold text-primary">TPI Inspection</h4>
                  <p>Pending: {showDetails.tpiInspection.pending}</p>
                  <p>Done: {showDetails.tpiInspection.done}</p>
                  <p>OK: {showDetails.tpiInspection.ok}</p>
                  <p>Not OK: {showDetails.tpiInspection.notOk}</p>
                </div>
                {showDetails.tpiRejections && showDetails.tpiRejections.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-primary">TPI - Rejection Details</h4>
                       <Table>
                        <TableHeader>
                          <TableRow><TableHead>Defect</TableHead><TableHead>Qty</TableHead><TableHead>Remarks</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {showDetails.tpiRejections.map((rej, i) => <TableRow key={`tpi-rej-${i}`}><TableCell>{rej.defectType}</TableCell><TableCell>{rej.quantity}</TableCell><TableCell>{rej.remarks || '-'}</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <h4 className="font-semibold text-primary">Dispatch</h4>
                  <p className="font-medium">RFD:</p>
                  <ul className="list-disc list-inside ml-4">
                    <li>Cumulative: {showDetails.dispatch.rfd.cumulative}</li>
                    <li>Today: {showDetails.dispatch.rfd.today}</li>
                  </ul>
                  <p className="font-medium mt-2">Dispatch Status:</p>
                  <ul className="list-disc list-inside ml-4">
                    <li>Cumulative: {showDetails.dispatch.dispatch.cumulative}</li>
                    <li>Today: {showDetails.dispatch.dispatch.today}</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDetails(null)}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
