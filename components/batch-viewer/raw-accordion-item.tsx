"use client"

import { Badge } from "@/components/ui/badge"
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { NcpdpRawView } from "./ncpdp-raw-view"

export function RawAccordionItem({ text }: { text: string }) {
  return (
    <AccordionItem value="raw">
      <AccordionTrigger className="py-2 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] px-1.5">
            RAW
          </Badge>
          <span className="text-muted-foreground">Raw transmission</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <NcpdpRawView text={text} />
      </AccordionContent>
    </AccordionItem>
  )
}
