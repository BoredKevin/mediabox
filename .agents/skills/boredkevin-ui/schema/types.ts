export type ComponentVariant = {
  name: string;
  description: string;
  whenToUse: string;
  exampleProps?: Record<string, unknown>;
};

export type ComponentProp = {
  name: string;
  type: string;
  defaultValue?: string;
  required?: boolean;
  description: string;
};

export type DesignTokenRef = {
  cssVar: string;
  tailwindClass?: string;
  role: string;
};

export type ComponentMeta = {
  /** Canonical component name, matches exported identifier */
  name: string;
  /** Named export(s) from the package */
  exports: string[];
  /** npm import path */
  importPath: string;
  /** One or two sentence description */
  description: string;
  /** When AI should reach for this component */
  whenToUse: string[];
  /** When AI should NOT use this component */
  whenNotToUse: string[];
  /** Anti-patterns to avoid */
  antiPatterns: string[];
  /** All supported variants */
  variants?: ComponentVariant[];
  /** Props reference */
  props: ComponentProp[];
  /**
   * Sub-components that must be composed together.
   * e.g. Card requires CardHeader, CardContent, etc.
   */
  composition?: {
    required?: string[];
    optional?: string[];
    rules?: string[];
  };
  /** Other components this one commonly combines with */
  relatedComponents?: string[];
  /** Design tokens this component consumes */
  tokens?: DesignTokenRef[];
  /** Short AI-targeted natural language hints */
  aiHints: string[];
  /** Ready-to-use code snippets */
  examples: Array<{
    label: string;
    code: string;
  }>;
  /** Radix UI primitive or native base */
  radixPrimitive?: string;
  /** Docs URL */
  docsUrl?: string;
};
