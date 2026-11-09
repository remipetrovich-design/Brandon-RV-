export function canAcceptJobAssignment(status: string): boolean;
export function canStartWorkOrder(jobStatus: string, assignmentStatus: string | null | undefined, canManage?: boolean): boolean;
export function canFinishWorkOrder(jobStatus: string, assignmentStatus: string | null | undefined, canManage?: boolean): boolean;
export function calculateWorkOrderTotals(items: Array<{entry_type?:string;line_total:number|string;tax_rate:number|string}>): {subtotal:number;taxAmount:number;total:number};
