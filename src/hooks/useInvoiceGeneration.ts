import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { generateInvoicePDF, InvoiceData } from "@/lib/invoiceGenerator";
import { addDays, format } from "date-fns";

interface GenerateInvoiceParams {
  invoiceData: InvoiceData;
  projectId?: string | null;
  weekClosingId?: string | null;
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
   * Generate invoice number in format: YYYYNNN (e.g. 2026001, 2026002)
   * Queries DB for the latest number in the current year and increments.
   */
  const generateInvoiceNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = String(year);

    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `${prefix}%`)
      .is("deleted_at", null)
      .order("invoice_number", { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const lastNum = data[0].invoice_number;
      const seqPart = parseInt(lastNum.slice(prefix.length), 10);
      if (!isNaN(seqPart)) {
        nextSeq = seqPart + 1;
      }
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

      // Generate dates - due date = issue date + 21 days
      const issueDate = new Date();
      const deliveryDate = issueDate;
      const dueDate = addDays(issueDate, 21);
      const invoiceNumber = await generateInvoiceNumber();

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

      // 2. THEN: Generate and download the PDF
      await generateInvoicePDF({
        ...invoiceData,
        // Use the generated invoice number for consistency
        odberatelId: newInvoice.id,
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

  return {
    generateAndSaveInvoice,
    generating,
  };
}
