


export interface Problem {
  
  id: number;
  title: string;
  description: string;
  createdAt: string;
  
  candidateAlgorithm: string;
  referenceAlgorithm: string;
  
  testCases: ProblemTestCase[];
  [key: string]: unknown;
}

export interface NewProblem {
  
  title: string;
  description: string;
  candidateAlgorithm: string;
  referenceAlgorithm: string;
  [key: string]: unknown;
}

export interface ProblemTestCase {
  
  id: number;
  
  input: string;
  
  output: string;
  createdAt: string;
}
