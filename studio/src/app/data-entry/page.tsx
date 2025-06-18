
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import { useInspectionData } from '@/hooks/useInspectionData';
import type { InspectionFormData, PartName, AISectionName, AISubsectionName, FormFieldConfig, RejectionEntry, UserRole, SectionFormConfig, Shift } from '@/lib/types';
import { DEFAULT_INSPECTION_VALUES, AI_SECTIONS_AND_SUBSECTIONS, USER_ROLES_LIST, SHIFT_OPTIONS } from '@/lib/types';
import { PART_NAMES_LIST, FORM_CONFIG, FINAL_INSPECTION_REJECTION_SECTION_CONFIG, TPI_REJECTION_SECTION_CONFIG, INITIAL_DEFECT_TYPES } from '@/lib/constants';
import { suggestInspectionStatus, type SuggestInspectionStatusInput, type SuggestInspectionStatusOutput } from '@/ai/flows/suggest-inspection-status';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDefectTypes } from '@/hooks/useDefectTypes';


import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";
import { CalendarIcon, AlertCircle, CheckCircle, HelpCircle, Wand2, Loader2, Trash2, PlusCircle, Ban, Lock } from 'lucide-react';

const createNumberSchema = () => z.number().min(0, "Value cannot be negative").default(0);

const rejectionEntrySchema = z.object({
  defectType: z.string({ required_error: "Defect type is required." }).min(1, "Defect type cannot be empty."),
  quantity: z.number().min(1, "Quantity must be at least 1."),
  remarks: z.string().optional(),
});


const inspectionFormSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  partName: z.enum(PART_NAMES_LIST as [string, ...string[]] as [PartName, ...PartName[]], { required_error: "Part name is required." }),
  shift: z.enum(SHIFT_OPTIONS, { required_error: "Shift is required."}),
  materialInspection: z.object({
    washingPending: createNumberSchema(),
    multigaugePending: createNumberSchema(),
  }),
  finalInspection: z.object({
    multigauge: z.object({
      total: createNumberSchema(),
      ok: createNumberSchema(),
      notOk: createNumberSchema(),
    }),
    visual: z.object({
      pending: createNumberSchema(),
      visualDone: createNumberSchema(),
      ok: createNumberSchema(),
      notOk: createNumberSchema(),
    }),
  }),
  tpiInspection: z.object({
    pending: createNumberSchema(),
    done: createNumberSchema(),
    ok: createNumberSchema(),
    notOk: createNumberSchema(),
  }),
  dispatch: z.object({
    rfd: z.object({
      cumulative: createNumberSchema(),
      today: createNumberSchema(),
    }),
    dispatch: z.object({
      cumulative: createNumberSchema(),
      today: createNumberSchema(),
    }),
  }),
  rejections: z.array(rejectionEntrySchema).optional().default([]),
  tpiRejections: z.array(rejectionEntrySchema).optional().default([]),
}).superRefine((data, ctx) => {
  const visualDone = data.finalInspection.visual.visualDone;
  const visualOk = data.finalInspection.visual.ok;
  const visualNotOk = data.finalInspection.visual.notOk;
  // This validation should only apply if visualDone is not auto-calculated (i.e., not FINAL_INSPECTOR role or if they could edit it)
  // For simplicity, we'll keep it, as auto-calculation should ensure consistency.
  // If manual edit is allowed for ADMIN and it mismatches, this rule will catch it.
  if (visualOk + visualNotOk > visualDone) {
     ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finalInspection", "visual", "ok"],
      message: "Sum of OK and Not OK cannot exceed Visual Done.",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["finalInspection", "visual", "notOk"],
      message: "Sum of OK and Not OK cannot exceed Visual Done.",
    });
  }

  const tpiDone = data.tpiInspection.done;
  const tpiOk = data.tpiInspection.ok;
  const tpiNotOk = data.tpiInspection.notOk;
  // Similar logic for TPI done
  if (tpiOk + tpiNotOk > tpiDone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tpiInspection", "ok"],
      message: "Sum of TPI OK and Not OK cannot exceed TPI Done.",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tpiInspection", "notOk"],
      message: "Sum of TPI OK and Not OK cannot exceed TPI Done.",
    });
  }
});


type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

export default function DataEntryPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { addRecord, getRecordByDatePartAndShift, updateRecord, getHistoricalDataForAI, getCumulativeValuesBeforeEntry, isLoading: isInspectionDataLoading } = useInspectionData();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const { currentRole, isLoadingRole } = useUserRole();
  const { defectTypes, isLoading: isLoadingDefects } = useDefectTypes();

  const [aiPartName, setAiPartName] = useState<PartName>(PART_NAMES_LIST[0]);
  const [aiSection, setAiSection] = useState<AISectionName | undefined>();
  const [aiSubsection, setAiSubsection] = useState<AISubsectionName | undefined>();
  const [aiSuggestion, setAiSuggestion] = useState<SuggestInspectionStatusOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      date: new Date(),
      partName: PART_NAMES_LIST[0],
      shift: SHIFT_OPTIONS[0],
      ...DEFAULT_INSPECTION_VALUES,
      rejections: [],
      tpiRejections: [],
    },
  });

  const { reset, watch, setValue, getValues, control } = form;

  const { fields: finalInspectionRejectionFields, append: appendFinalInspectionRejection, remove: removeFinalInspectionRejection } = useFieldArray({
    control,
    name: "rejections",
  });

  const { fields: tpiRejectionFields, append: appendTpiRejection, remove: removeTpiRejection } = useFieldArray({
    control,
    name: "tpiRejections",
  });

  const watchedFormPartName = watch("partName");
  const watchedFormShift = watch("shift");
  const watchedRfdToday = watch('dispatch.rfd.today');
  const watchedDispatchToday = watch('dispatch.dispatch.today');
  const watchedMultigaugeOk = watch('finalInspection.multigauge.ok');
  const watchedMultigaugeNotOk = watch('finalInspection.multigauge.notOk');
  const watchedVisualOk = watch('finalInspection.visual.ok');
  const watchedVisualNotOk = watch('finalInspection.visual.notOk');
  const watchedTpiOk = watch('tpiInspection.ok');
  const watchedTpiNotOk = watch('tpiInspection.notOk');


  const watchedFormDateObject = watch("date");
  const formDateString = watchedFormDateObject ? format(watchedFormDateObject, 'yyyy-MM-dd') : null;

  const stableSetIsEditing = useCallback(setIsEditing, []);
  const stableSetEditingRecordId = useCallback(setEditingRecordId, []);

  const isDataViewerRole = currentRole === USER_ROLES_LIST[3]; 

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (formDateString && watchedFormPartName && watchedFormShift && !isInspectionDataLoading && currentUser) { 
      const existingRecord = getRecordByDatePartAndShift(formDateString, watchedFormPartName, watchedFormShift);
      if (existingRecord) {
        reset({
          ...existingRecord,
          date: parseISO(existingRecord.date), 
          rejections: existingRecord.rejections || [],
          tpiRejections: existingRecord.tpiRejections || [],
        });
        stableSetIsEditing(true);
        stableSetEditingRecordId(existingRecord.id);
      } else {
        const currentDateInForm = getValues('date') || new Date(); 
        const currentPartInForm = getValues('partName') || PART_NAMES_LIST[0];
        const currentShiftInForm = getValues('shift') || SHIFT_OPTIONS[0];
        reset({
          date: currentDateInForm, 
          partName: currentPartInForm,
          shift: currentShiftInForm,
          ...DEFAULT_INSPECTION_VALUES,
          rejections: [],
          tpiRejections: [],
        });
        stableSetIsEditing(false);
        stableSetEditingRecordId(null);
      }
    }
  }, [formDateString, watchedFormPartName, watchedFormShift, getRecordByDatePartAndShift, reset, getValues, stableSetIsEditing, stableSetEditingRecordId, isInspectionDataLoading, currentUser]);


  useEffect(() => {
    if (!formDateString || !watchedFormPartName || !watchedFormShift || isInspectionDataLoading || !currentUser) {
      return;
    }

    const { cumRfd, cumDispatch } = getCumulativeValuesBeforeEntry(formDateString, watchedFormPartName, watchedFormShift);

    const currentRfdToday = Number(watchedRfdToday) || 0;
    const currentDispatchToday = Number(watchedDispatchToday) || 0;

    setValue('dispatch.rfd.cumulative', cumRfd + currentRfdToday, { shouldValidate: true, shouldDirty: true });
    setValue('dispatch.dispatch.cumulative', cumDispatch + currentDispatchToday, { shouldValidate: true, shouldDirty: true });

  }, [
    formDateString,
    watchedFormPartName,
    watchedFormShift,
    watchedRfdToday,
    watchedDispatchToday,
    getCumulativeValuesBeforeEntry,
    setValue,
    isInspectionDataLoading,
    currentUser
  ]);

  useEffect(() => {
    const currentOk = Number(watchedMultigaugeOk) || 0;
    const currentNotOk = Number(watchedMultigaugeNotOk) || 0;
    const total = currentOk + currentNotOk;
    setValue('finalInspection.multigauge.total', total, { shouldValidate: true, shouldDirty: true });
  }, [watchedMultigaugeOk, watchedMultigaugeNotOk, setValue]);

  useEffect(() => {
    if (currentRole === USER_ROLES_LIST[2]) { // FINAL_INSPECTOR
      const ok = Number(watchedVisualOk) || 0;
      const notOk = Number(watchedVisualNotOk) || 0;
      setValue('finalInspection.visual.visualDone', ok + notOk, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedVisualOk, watchedVisualNotOk, currentRole, setValue]);

  useEffect(() => {
    if (currentRole === USER_ROLES_LIST[1]) { // TPI_INSPECTOR
      const ok = Number(watchedTpiOk) || 0;
      const notOk = Number(watchedTpiNotOk) || 0;
      setValue('tpiInspection.done', ok + notOk, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedTpiOk, watchedTpiNotOk, currentRole, setValue]);


  const onSubmit = useCallback(async (data: InspectionFormValues) => {
    if (!currentUser || !currentRole) {
        toast({ title: "Authentication Error", description: "You must be logged in to save data.", variant: "destructive" });
        return;
    }
    if (isDataViewerRole || isLoadingRole) {
        toast({ title: "Permission Denied", description: "Data viewers cannot save or update records.", variant: "destructive" });
        return;
    }
    
    const formDataForStorage: InspectionFormData = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'), 
      shift: data.shift,
      rejections: data.rejections || [],
      tpiRejections: data.tpiRejections || [],
    };

    try {
      if (isEditing && editingRecordId) {
        await updateRecord({ ...formDataForStorage, id: editingRecordId });
        toast({ title: "Record Updated", description: `Inspection data for ${data.partName} (Shift ${data.shift}) on ${format(data.date, 'PPP')} has been updated.`, variant: "default" });
      } else {
        await addRecord(formDataForStorage);
        toast({ title: "Record Saved", description: `Inspection data for ${data.partName} (Shift ${data.shift}) on ${format(data.date, 'PPP')} has been saved.`, variant: "default" });
      }
      if (!isEditing) { 
         const currentDateInForm = getValues('date') || new Date();
         form.reset({
            date: currentDateInForm,
            partName: getValues('partName') || PART_NAMES_LIST[0],
            shift: getValues('shift') || SHIFT_OPTIONS[0],
            ...DEFAULT_INSPECTION_VALUES,
            rejections: [],
            tpiRejections: [],
        });
      }
    } catch (error) {
      console.error("Error saving data:", error);
      toast({ title: "Error", description: "Failed to save inspection data. Please try again.", variant: "destructive" });
    }
  }, [currentUser, currentRole, isDataViewerRole, isLoadingRole, isEditing, editingRecordId, updateRecord, addRecord, toast, form, getValues]);

  const handleAiSuggestion = useCallback(async () => {
    if (!aiPartName || !aiSection || !aiSubsection) {
      setAiError("Please select Part, Section, and Subsection for AI suggestion.");
      return;
    }
    setIsAiLoading(true);
    setAiSuggestion(null);
    setAiError(null);
    try {
      const historicalData = getHistoricalDataForAI(aiPartName);
      const input: SuggestInspectionStatusInput = {
        partName: aiPartName,
        section: aiSection,
        subsection: aiSubsection,
        historicalData,
      };
      const result = await suggestInspectionStatus(input);
      setAiSuggestion(result);
    } catch (err) {
      console.error("AI suggestion error:", err);
      setAiError("Failed to get AI suggestion. Please try again.");
      toast({ title: "AI Error", description: "Could not fetch suggestion.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  }, [aiPartName, aiSection, aiSubsection, getHistoricalDataForAI, toast]);

  const currentFormConfig = FORM_CONFIG[watchedFormPartName] || FORM_CONFIG[PART_NAMES_LIST[0]];
  
  const getFieldDisabledState = useCallback((fieldConfig: FormFieldConfig, sectionConfig: SectionFormConfig) => {
    if (isLoadingRole || !currentRole) return true;
    if (currentRole === USER_ROLES_LIST[3]) return true; // DATA_VIEWER is always read-only

    // Cumulative RFD and Dispatch are only editable by ADMIN
    if (fieldConfig.name === 'dispatch.rfd.cumulative' || fieldConfig.name === 'dispatch.dispatch.cumulative') {
      return currentRole !== USER_ROLES_LIST[0]; // true if not ADMIN (disabled), false if ADMIN (enabled)
    }
    
    // Visual Done is disabled for FINAL_INSPECTOR (auto-calculated)
    if (fieldConfig.name === 'finalInspection.visual.visualDone' && currentRole === USER_ROLES_LIST[2]) { // FINAL_INSPECTOR
        return true;
    }

    // TPI Done is disabled for TPI_INSPECTOR (auto-calculated)
    if (fieldConfig.name === 'tpiInspection.done' && currentRole === USER_ROLES_LIST[1]) { // TPI_INSPECTOR
        return true;
    }

    // Section-level read-only for current role
    if (sectionConfig.readOnlyForRoles?.includes(currentRole)) return true;
    
    // Field-level explicit disabledForRoles from config (this might be redundant for some cases handled above but good for others)
    if (fieldConfig.disabledForRoles?.includes(currentRole)) return true;
    
    // General disabled flag from config (e.g., multigauge.total is always disabled)
    return fieldConfig.disabled || false; 
  }, [isLoadingRole, currentRole]);
  
  const isSectionVisible = useCallback((sectionConfig: SectionFormConfig | undefined) => {
    if (!sectionConfig) return false;
    if (isLoadingRole || !currentRole) return false; 
    if (currentRole === USER_ROLES_LIST[3]) return true; // DATA_VIEWER can see all sections (read-only)

    return !sectionConfig.hiddenForRoles?.includes(currentRole);
  }, [isLoadingRole, currentRole]);

  const isRejectionSectionVisibleAndEditable = useCallback((config: Pick<SectionFormConfig, 'hiddenForRoles' | 'readOnlyForRoles'> | undefined) => {
    if (!config) return { visible: false, editable: false };
    if (isLoadingRole || !currentRole) return { visible: false, editable: false };

    const isVisible = currentRole === USER_ROLES_LIST[3] ? true : !config.hiddenForRoles?.includes(currentRole);
    const isEditable = currentRole === USER_ROLES_LIST[3] ? false : !config.readOnlyForRoles?.includes(currentRole);
    
    return { visible: isVisible, editable: isEditable };
  }, [isLoadingRole, currentRole]);

  const finalRejectionAccess = isRejectionSectionVisibleAndEditable(FINAL_INSPECTION_REJECTION_SECTION_CONFIG);
  const tpiRejectionAccess = isRejectionSectionVisibleAndEditable(TPI_REJECTION_SECTION_CONFIG);

  const defaultDefectType = defectTypes.length > 0 ? defectTypes[0] : (INITIAL_DEFECT_TYPES.length > 0 ? INITIAL_DEFECT_TYPES[0] : "");


  if (authLoading || isLoadingRole || isInspectionDataLoading || isLoadingDefects) {
    console.log("DataEntryPage: Rendering loading state. Flags:", { authLoading, isLoadingRole, isInspectionDataLoading, isLoadingDefects });
    return <div className="container mx-auto py-8 flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading data entry form...</p></div>;
  }
  
  if (!currentUser && !authLoading) { 
    return <div className="container mx-auto py-8 text-center"><p>Please <Link href="/login" className="text-primary underline">login</Link> to enter data.</p></div>;
  }


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold font-headline mb-2 text-foreground">Daily Inspection Data Entry</h1>
      <p className="text-muted-foreground mb-8">{isEditing ? "Editing existing record." : "Enter new inspection data for the day."} {(isDataViewerRole || !currentRole) && "(Read-only mode)"}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-primary">Basic Information</CardTitle>
                <CardDescription>Select the date, part, and shift for this inspection record.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Inspection Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                               disabled={isDataViewerRole || isLoadingRole || !currentRole}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("2000-01-01") || isDataViewerRole || isLoadingRole || !currentRole}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="partName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Name</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isDataViewerRole || isLoadingRole || !currentRole}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a part" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PART_NAMES_LIST.map(part => <SelectItem key={part} value={part}>{part}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={control}
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isDataViewerRole || isLoadingRole || !currentRole}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SHIFT_OPTIONS.map(shift => <SelectItem key={shift} value={shift}>Shift {shift}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Accordion type="multiple" defaultValue={Object.keys(currentFormConfig)} className="w-full space-y-4">
              {Object.entries(currentFormConfig).map(([sectionKey, sectionConfig]) => {
                if (!isSectionVisible(sectionConfig)) return null;
                
                const isEffectivelyReadOnlyForSection = isLoadingRole || !currentRole || isDataViewerRole || sectionConfig.readOnlyForRoles?.includes(currentRole as UserRole);

                return (
                <AccordionItem key={sectionKey} value={sectionKey} className="border bg-card rounded-lg shadow-md">
                  <AccordionTrigger className={cn("px-6 py-4 text-lg font-semibold hover:bg-accent/10 rounded-t-lg data-[state=open]:rounded-b-none data-[state=open]:border-b", isEffectivelyReadOnlyForSection && "cursor-not-allowed")}>
                    <div className="flex items-center gap-2">
                      {sectionConfig.icon && <sectionConfig.icon className="h-5 w-5 text-primary" />}
                      {sectionConfig.title}
                      {isEffectivelyReadOnlyForSection && <Lock className="h-4 w-4 text-muted-foreground ml-2" title="Section read-only or restricted for current role" />}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 border-t">
                    <div className="space-y-6">
                      {Object.entries(sectionConfig.subsections).map(([subKey, subConfig]) => (
                        <div key={subKey}>
                          <h4 className="text-md font-medium mb-2 text-foreground/80">{subConfig.title}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {subConfig.fields.map((fieldConfig: FormFieldConfig) => (
                              <FormField
                                key={fieldConfig.name}
                                control={control}
                                name={fieldConfig.name as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{fieldConfig.label}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type={fieldConfig.type}
                                        placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                                        {...field}
                                        value={field.value || ''}
                                        onChange={e => field.onChange(fieldConfig.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                                        disabled={getFieldDisabledState(fieldConfig, sectionConfig)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )})}

            {finalRejectionAccess.visible && (
              <AccordionItem value="finalInspectionRejectionDetails" className="border bg-card rounded-lg shadow-md">
                <AccordionTrigger className={cn("px-6 py-4 text-lg font-semibold hover:bg-accent/10 rounded-t-lg data-[state=open]:rounded-b-none data-[state=open]:border-b", !finalRejectionAccess.editable && "opacity-70 cursor-not-allowed")}>
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-destructive" />
                    Final Inspection - Rejection Details
                    {!finalRejectionAccess.editable && <Lock className="h-4 w-4 text-muted-foreground ml-2" title="Section read-only for current role" />}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 py-4 border-t">
                  <div className="space-y-4">
                    {finalInspectionRejectionFields.map((field, index) => (
                      <Card key={field.id} className="p-4 space-y-3 bg-background/50 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <FormField
                            control={control}
                            name={`rejections.${index}.defectType`}
                            render={({ field: defectField }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Defect Type</FormLabel>
                                <Select
                                  onValueChange={defectField.onChange}
                                  value={defectField.value}
                                  disabled={!finalRejectionAccess.editable || isLoadingDefects}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={isLoadingDefects ? "Loading defects..." : "Select defect"} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {isLoadingDefects ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                                      defectTypes.length > 0 ? defectTypes.map(defect => (
                                        <SelectItem key={defect} value={defect}>{defect}</SelectItem>
                                      )) : <SelectItem value="noDefects" disabled>No defects configured</SelectItem>
                                    }
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={control}
                            name={`rejections.${index}.quantity`}
                            render={({ field: qtyField }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="Qty"
                                    {...qtyField}
                                    value={qtyField.value || ''}
                                    onChange={e => qtyField.onChange(parseInt(e.target.value) || 0)}
                                    min="1"
                                    disabled={!finalRejectionAccess.editable}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFinalInspectionRejection(index)}
                              className="text-destructive hover:bg-destructive/10 md:col-span-1 self-end"
                              title="Remove Defect"
                              disabled={!finalRejectionAccess.editable}
                            >
                              <Trash2 className="h-5 w-5" />
                           </Button>
                        </div>
                        <FormField
                          control={control}
                          name={`rejections.${index}.remarks`}
                          render={({ field: remarksField }) => (
                            <FormItem>
                              <FormLabel>Remarks (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add any remarks for this defect"
                                  {...remarksField}
                                  value={remarksField.value || ''}
                                  disabled={!finalRejectionAccess.editable}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendFinalInspectionRejection({ defectType: defaultDefectType, quantity: 1, remarks: "" })}
                      className="mt-2 text-primary border-primary hover:bg-primary/10"
                      disabled={!finalRejectionAccess.editable || isLoadingDefects || defectTypes.length === 0}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Final Insp. Defect
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {tpiRejectionAccess.visible && (
              <AccordionItem value="tpiRejectionDetails" className="border bg-card rounded-lg shadow-md">
                 <AccordionTrigger className={cn("px-6 py-4 text-lg font-semibold hover:bg-accent/10 rounded-t-lg data-[state=open]:rounded-b-none data-[state=open]:border-b", !tpiRejectionAccess.editable && "opacity-70 cursor-not-allowed")}>
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5 text-destructive" />
                    TPI - Rejection Details
                    {!tpiRejectionAccess.editable && <Lock className="h-4 w-4 text-muted-foreground ml-2" title="Section read-only for current role" />}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 py-4 border-t">
                  <div className="space-y-4">
                    {tpiRejectionFields.map((field, index) => (
                      <Card key={field.id} className="p-4 space-y-3 bg-background/50 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <FormField
                            control={control}
                            name={`tpiRejections.${index}.defectType`}
                            render={({ field: defectField }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Defect Type</FormLabel>
                                <Select
                                  onValueChange={defectField.onChange}
                                  value={defectField.value}
                                  disabled={!tpiRejectionAccess.editable || isLoadingDefects}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={isLoadingDefects ? "Loading defects..." : "Select defect"} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {isLoadingDefects ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                                      defectTypes.length > 0 ? defectTypes.map(defect => (
                                        <SelectItem key={defect} value={defect}>{defect}</SelectItem>
                                      )) : <SelectItem value="noDefects" disabled>No defects configured</SelectItem>
                                    }
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <FormField
                            control={control}
                            name={`tpiRejections.${index}.quantity`}
                            render={({ field: qtyField }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="Qty"
                                    {...qtyField}
                                    value={qtyField.value || ''}
                                    onChange={e => qtyField.onChange(parseInt(e.target.value) || 0)}
                                    min="1"
                                    disabled={!tpiRejectionAccess.editable}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTpiRejection(index)}
                              className="text-destructive hover:bg-destructive/10 md:col-span-1 self-end"
                              title="Remove Defect"
                              disabled={!tpiRejectionAccess.editable}
                            >
                              <Trash2 className="h-5 w-5" />
                           </Button>
                        </div>
                        <FormField
                          control={control}
                          name={`tpiRejections.${index}.remarks`}
                          render={({ field: remarksField }) => (
                            <FormItem>
                              <FormLabel>Remarks (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add any remarks for TPI defect"
                                  {...remarksField}
                                  value={remarksField.value || ''}
                                  disabled={!tpiRejectionAccess.editable}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendTpiRejection({ defectType: defaultDefectType, quantity: 1, remarks: "" })}
                      className="mt-2 text-primary border-primary hover:bg-primary/10"
                      disabled={!tpiRejectionAccess.editable || isLoadingDefects || defectTypes.length === 0}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add TPI Defect Entry
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            </Accordion>

            <Button type="submit" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-3 px-6" disabled={isDataViewerRole || isLoadingRole || !currentRole}>
              {isEditing ? "Update Record" : "Save Record"}
            </Button>
          </form>
        </Form>

        <Card className="lg:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle className="text-accent flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Status Suggestion
            </CardTitle>
            <CardDescription>Get an AI-powered suggestion for inspection status based on historical data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormItem>
              <Label>Part Name</Label>
              <Select value={aiPartName} onValueChange={(val) => setAiPartName(val as PartName)}>
                <SelectTrigger><SelectValue placeholder="Select Part" /></SelectTrigger>
                <SelectContent>
                  {PART_NAMES_LIST.map(part => <SelectItem key={part} value={part}>{part}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem>
              <Label>Inspection Section</Label>
              <Select value={aiSection} onValueChange={(val) => { setAiSection(val as AISectionName); setAiSubsection(undefined); }}>
                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(AI_SECTIONS_AND_SUBSECTIONS).map(sec => <SelectItem key={sec} value={sec}>{sec}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
            {aiSection && (
              <FormItem>
                <Label>Specific Item / Subsection</Label>
                <Select value={aiSubsection} onValueChange={(val) => setAiSubsection(val as AISubsectionName)}>
                  <SelectTrigger><SelectValue placeholder="Select Subsection" /></SelectTrigger>
                  <SelectContent>
                    {AI_SECTIONS_AND_SUBSECTIONS[aiSection]?.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
            <Button onClick={handleAiSuggestion} disabled={isAiLoading || !aiPartName || !aiSection || !aiSubsection} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {isAiLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Suggestion
            </Button>
            {aiError && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4"/> {aiError}</p>}
          </CardContent>
          {aiSuggestion && (
            <CardFooter className="flex flex-col items-start space-y-2 border-t pt-4">
              <h4 className="font-semibold text-foreground flex items-center gap-1"><CheckCircle className="h-5 w-5 text-green-500" /> AI Suggestion:</h4>
              <p><strong className="text-primary">Status:</strong> {aiSuggestion.suggestedStatus}</p>
              <p><strong className="text-primary">Confidence:</strong> {(aiSuggestion.confidenceLevel * 100).toFixed(0)}%</p>
              <p><strong className="text-primary">Rationale:</strong> {aiSuggestion.rationale}</p>
            </CardFooter>
          )}
           {!aiSuggestion && !isAiLoading && !aiError && (
            <CardFooter className="border-t pt-4">
                <p className="text-sm text-muted-foreground flex items-center gap-1"><HelpCircle className="h-4 w-4"/> Select parameters and click "Get Suggestion".</p>
            </CardFooter>
           )}
        </Card>
      </div>
    </div>
  );
}

