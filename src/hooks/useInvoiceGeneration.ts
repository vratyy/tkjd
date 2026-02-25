import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { generateInvoicePDF, InvoiceData } from "@/lib/invoiceGenerator";
import { getISOWeekLocal, getISOWeekYear } from "@/lib/dateUtils";
import { addDays, format } from "date-fns";

interface GenerateInvoiceParams {
  invoiceData: InvoiceData;
  projectId?: string | null;
  weekClosingId?: string | null;
  /** Override issue date (YYYY-MM-DD) for historical invoices */
  overrideIssueDate?: string;
  /** Override delivery date (YYYY-MM-DD) for historical invoices */
  overrideDeliveryDate?: string;
}

/**
 * Hook to handle invoice generation with automatic database persistence.
 * This ensures the Financial Dashboard updates when invoices are created.
 */
export function useInvoiceGeneration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const safeNumber = (val: unknown): number => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  /**
   * Check if a user is "Viktor" (fixed-fee retainer user).
   */
  const isViktorUser = (fullName: string): boolean => {
    return fullName.toLowerCase().startsWith("viktor");
  };

  /**
   * Generate invoice number in format: YYYYNNN (e.g. 2026001, 2026002)
   * For Viktor: VIK-YYYYNNN (e.g. VIK-2026001)
   * Queries DB for the latest number in the current year and increments.
   */
  const generateInvoiceNumber = async (viktorMode = false): Promise<string> => {
    if (!user) throw new Error("User not authenticated");
    const year = new Date().getFullYear();

    if (viktorMode) {
      const vikPrefix = `VIK-${year}`;
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("user_id", user.id)
        .like("invoice_number", `${vikPrefix}%`)
        .is("deleted_at", null)
        .order("invoice_number", { ascending: false })
        .limit(1);

      let nextSeq = 1;
      if (data && data.length > 0) {
        const lastNum = data[0].invoice_number;
        const seqPart = parseInt(lastNum.slice(vikPrefix.length), 10);
        if (!isNaN(seqPart)) nextSeq = seqPart + 1;
      }
      return `${vikPrefix}${String(nextSeq).padStart(3, "0")}`;
    }

    const prefix = String(year);
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", user.id)
      .like("invoice_number", `${prefix}%`)
      .not("invoice_number", "like", "VIK-%")
      .is("deleted_at", null)
      .order("invoice_number", { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const lastNum = data[0].invoice_number;
      const seqPart = parseInt(lastNum.slice(prefix.length), 10);
      if (!isNaN(seqPart)) nextSeq = seqPart + 1;
    }

    return `${prefix}${String(nextSeq).padStart(3, "0")}`;
  };

  /**
   * Generate PDF and SAVE invoice to database in one atomic operation.
   * This is the critical fix: no PDF without database record.
   */
  const generateAndSaveInvoice = async ({
    invoiceData,
    projectId,
    weekClosingId,
    overrideIssueDate,
    overrideDeliveryDate,
  }: GenerateInvoiceParams): Promise<{ success: boolean; invoiceId?: string }> => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Používateľ nie je prihlásený",
      });
      return { success: false };
    }

    setGenerating(true);

    try {
      // Idempotency check: prevent duplicate invoice for same week_closing
      if (weekClosingId) {
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("user_id", user.id)
          .eq("week_closing_id", weekClosingId)
          .is("deleted_at", null)
          .neq("status", "void")
          .limit(1);

        if (existing && existing.length > 0) {
          toast({
            variant: "destructive",
            title: "Faktúra už existuje",
            description: "Faktúra pre tohto dodávateľa a tento týždeň už bola vygenerovaná.",
          });
          return { success: false };
        }
      }

      // Calculate amounts
      const totalHours = safeNumber(invoiceData.totalHours);
      const hourlyRate = safeNumber(invoiceData.hourlyRate);
      const baseAmount = totalHours * hourlyRate;
      const advanceDeduction = safeNumber(invoiceData.advanceDeduction);
      
      const VAT_RATE = 0.20;
      let vatAmount = 0;
      let totalAmount = baseAmount - advanceDeduction;
      
      if (invoiceData.isVatPayer && !invoiceData.isReverseCharge) {
        vatAmount = baseAmount * VAT_RATE;
        totalAmount = baseAmount + vatAmount - advanceDeduction;
      }

      // Generate dates - use overrides for historical invoices
      // Issue date = Monday after the work week; Due date = issue date + 21 days
      const issueDate = overrideIssueDate
        ? new Date(overrideIssueDate + "T12:00:00")
        : new Date();
      const deliveryDate = overrideDeliveryDate
        ? new Date(overrideDeliveryDate + "T12:00:00")
        : issueDate;
      const dueDate = addDays(issueDate, 21);
      // Detect Viktor for custom numbering
      const viktorMode = isViktorUser(invoiceData.supplierName || "");
      const invoiceNumber = await generateInvoiceNumber(viktorMode);

      // 1. FIRST: Insert invoice record into database
      const { data: newInvoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          user_id: user.id,
          project_id: projectId || null,
          week_closing_id: weekClosingId || null,
          total_hours: totalHours,
          hourly_rate: hourlyRate,
          subtotal: baseAmount,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          advance_deduction: advanceDeduction,
          issue_date: format(issueDate, "yyyy-MM-dd"),
          delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "pending", // "Vystavená" - sent/pending payment
          is_reverse_charge: invoiceData.isReverseCharge || false,
          transaction_tax_rate: 0.4, // Default transaction tax rate
          transaction_tax_amount: Math.ceil((totalAmount * 0.4) / 100 * 100) / 100,
          tax_payment_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Nepodarilo sa uložiť faktúru: ${insertError.message}`);
      }

      // 2. THEN: Generate and download the PDF with historical dates from DB
      await generateInvoicePDF({
        ...invoiceData,
        invoiceNumber: invoiceNumber,
        odberatelId: newInvoice.id,
        historicalIssueDate: format(issueDate, "yyyy-MM-dd"),
        historicalDeliveryDate: format(deliveryDate, "yyyy-MM-dd"),
        historicalDueDate: format(dueDate, "yyyy-MM-dd"),
      });

      toast({
        title: "Faktúra vygenerovaná",
        description: `Faktúra ${invoiceNumber} bola vytvorená a uložená do systému.`,
      });

      return { success: true, invoiceId: newInvoice.id };
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast({
        variant: "destructive",
        title: "Chyba pri generovaní faktúry",
        description: error.message || "Nepodarilo sa vygenerovať faktúru",
      });
      return { success: false };
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Generate a fixed-fee retainer invoice for Viktor (50h / 1000€).
   * Also creates the weekly_closing record automatically.
   */
  const generateViktorRetainer = async (
    viktorUserId: string,
    calendarWeek: number,
    year: number,
    projectId?: string
  ): Promise<{ success: boolean }> => {
    if (!user) return { success: false };

    setGenerating(true);
    try {
      // 1. Create weekly_closing
      const { data: closing, error: closingErr } = await supabase
        .from("weekly_closings")
        .insert({
          user_id: viktorUserId,
          calendar_week: calendarWeek,
          year: year,
          status: "approved",
          submitted_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .select()
        .single();

      if (closingErr) throw new Error(closingErr.message);

      // 2. Generate invoice
      const invoiceNumber = await generateInvoiceNumber(true);
      const issueDate = new Date();
      const dueDate = addDays(issueDate, 21);

      const { error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          user_id: viktorUserId,
          project_id: projectId || null,
          week_closing_id: closing.id,
          total_hours: 50,
          hourly_rate: 20,
          subtotal: 1000,
          vat_amount: 0,
          total_amount: 1000,
          advance_deduction: 0,
          issue_date: format(issueDate, "yyyy-MM-dd"),
          delivery_date: format(issueDate, "yyyy-MM-dd"),
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "pending",
          is_reverse_charge: false,
          transaction_tax_rate: 0.4,
          transaction_tax_amount: 400,
          tax_payment_status: "pending",
        });

      if (invErr) throw new Error(invErr.message);

      toast({
        title: "Paušál vygenerovaný",
        description: `Faktúra ${invoiceNumber} pre Viktora (KW${calendarWeek}) bola vytvorená.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error generating Viktor retainer:", error);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
      return { success: false };
    } finally {
      setGenerating(false);
    }
  };

  return {
    generateAndSaveInvoice,
    generateViktorRetainer,
    isViktorUser,
    generating,
  };
}
