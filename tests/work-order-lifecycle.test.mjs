import test from "node:test";
import assert from "node:assert/strict";
import {canAcceptJobAssignment,canStartWorkOrder,canFinishWorkOrder,calculateWorkOrderTotals} from "../src/lib/work-order-lifecycle.mjs";

test("only a pending assignment can be accepted",()=>{
 assert.equal(canAcceptJobAssignment("assigned"),true);
 assert.equal(canAcceptJobAssignment("accepted"),false);
 assert.equal(canAcceptJobAssignment("removed"),false);
});

test("a worker must accept an assignment before starting a pending Work Order",()=>{
 assert.equal(canStartWorkOrder("pending","accepted"),true);
 assert.equal(canStartWorkOrder("scheduled","accepted"),true);
 assert.equal(canStartWorkOrder("pending","assigned"),false);
 assert.equal(canStartWorkOrder("completed","accepted"),false);
});

test("only an accepted worker can finish an in-progress Work Order",()=>{
 assert.equal(canFinishWorkOrder("in_progress","accepted"),true);
 assert.equal(canFinishWorkOrder("pending","accepted"),false);
 assert.equal(canFinishWorkOrder("in_progress","assigned"),false);
 assert.equal(canFinishWorkOrder("in_progress","assigned",true),true);
});

test("invoice totals include labour and parts but exclude notes and tests",()=>{
 assert.deepEqual(calculateWorkOrderTotals([
  {entry_type:"labour",line_total:200,tax_rate:10},
  {entry_type:"parts",line_total:50,tax_rate:10},
  {entry_type:"note",line_total:0,tax_rate:0},
  {entry_type:"test",line_total:0,tax_rate:0}
 ]),{subtotal:250,taxAmount:25,total:275});
});
