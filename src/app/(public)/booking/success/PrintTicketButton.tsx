'use client';

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function PrintTicketButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button onClick={handlePrint} className="flex-1 bg-[#1b4d3e] hover:bg-[#153e31] text-white py-6 flex items-center gap-2 print:hidden">
      <Download className="w-4 h-4" /> Download PDF
    </Button>
  );
}
