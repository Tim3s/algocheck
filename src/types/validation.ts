
export interface TestCaseResult {
  
  testCaseId: number;
  
  candidate: "PASS" | "FAIL";
  reference: "PASS" | "FAIL";
  
  matching: boolean;
  details?: string;
}
