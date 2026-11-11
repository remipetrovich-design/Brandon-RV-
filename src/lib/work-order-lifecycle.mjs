export function canAcceptJobAssignment(status) {
  return status === "assigned";
}
export function canStartWorkOrder(jobStatus, assignmentStatus, canManage = false) {
  return (canManage || assignmentStatus === "accepted") && ["pending", "scheduled"].includes(jobStatus);
}
export function canFinishWorkOrder(jobStatus, assignmentStatus, canManage = false) {
  return (canManage || assignmentStatus === "accepted") && jobStatus === "in_progress";
}
export function calculateWorkOrderTotals(items) {
  const billable = items.filter(item => !["note", "test"].includes(item.entry_type));
  const subtotal = Number(billable.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2));
  const taxAmount = Number(billable.reduce((sum, item) => sum + Number(item.line_total || 0) * Number(item.tax_rate || 0) / 100, 0).toFixed(2));
  return { subtotal, taxAmount, total: Number((subtotal + taxAmount).toFixed(2)) };
}
