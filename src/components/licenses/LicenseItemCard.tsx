import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { LicenseEntry } from '../LicensesModal';

interface LicenseItemCardProps {
  pkg: LicenseEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isCopied: boolean;
  onCopy: (text: string) => void;
}

export const LicenseItemCard: React.FC<LicenseItemCardProps> = ({
  pkg,
  isExpanded,
  onToggleExpand,
  isCopied,
  onCopy,
}) => {
  if (pkg.isRoot) {
    // Highlighted Card for mediabox (Host App)
    return (
      <div className="relative p-4 rounded-md border border-border bg-muted/30 transition-all shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-base text-foreground">
                {pkg.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                v{pkg.version}
              </span>
              <Badge variant="default" className="text-[10px] tracking-wider uppercase font-mono">
                Host Application
              </Badge>
              <Badge variant="outline" className="border-border text-foreground text-[10px] font-mono">
                {pkg.license}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {pkg.description} &bull; Author: {pkg.publisher}
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            {pkg.repository && (
              <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1.5">
                <a href={pkg.repository} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  GitHub
                </a>
              </Button>
            )}
            {pkg.licenseText && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-7 text-xs gap-1"
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {isExpanded ? 'Hide License' : 'View License'}
              </Button>
            )}
          </div>
        </div>

        {/* Attribution Requirement Callout */}
        <div className="mt-3 p-2.5 rounded bg-background/60 border border-primary/20 text-xs text-foreground/90 font-mono">
          <span className="text-foreground font-bold">Attribution Requirement:</span> You must include the prominent display of the phrase &ldquo;Powered by boredkevin/mediabox&rdquo; in the user interface of any Deployment or Derivative Work.
        </div>

        {/* Full License Text */}
        {isExpanded && pkg.licenseText && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-mono text-muted-foreground">
                Full License Agreement (CPAL-1.0)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(pkg.licenseText!)}
                className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              >
                {isCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {isCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="p-3 bg-background/90 border border-border/80 rounded text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-56 overflow-y-auto leading-relaxed selection:bg-muted">
              {pkg.licenseText}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Standard Dependency Card
  return (
    <div className="p-3.5 rounded-md border border-border/70 bg-card/40 hover:border-border transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-sm text-foreground truncate">
              {pkg.name}
            </span>
            {pkg.version && (
              <span className="text-xs font-mono text-muted-foreground">
                v{pkg.version}
              </span>
            )}
            {pkg.isDirect && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                Direct
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] font-mono ${
                pkg.license.includes('Apache') || pkg.license.includes('CPAL')
                  ? 'border-border text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {pkg.license}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground truncate">
            {pkg.publisher && <span>by {pkg.publisher}</span>}
            {pkg.publisher && pkg.description && <span> &bull; </span>}
            {pkg.description && <span>{pkg.description}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          {pkg.repository && (
            <Button variant="outline" size="sm" asChild className="h-7 text-xs gap-1">
              <a href={pkg.repository} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            </Button>
          )}
          {pkg.licenseText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-7 text-xs gap-1"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isExpanded ? 'Hide' : 'License'}
            </Button>
          )}
        </div>
      </div>

      {/* Expandable License Block */}
      {isExpanded && pkg.licenseText && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[11px] font-mono text-muted-foreground">
              License Text ({pkg.license})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(pkg.licenseText!)}
              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
              {isCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="p-3 bg-muted/20 border border-border/60 rounded text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-48 overflow-y-auto leading-relaxed">
            {pkg.licenseText}
          </pre>
        </div>
      )}
    </div>
  );
};
