import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  CornerEdges,
} from '@boredkevin/ui';
import {
  Scale,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  X,
  FileCode2,
} from 'lucide-react';
import rawLicensesData from '@/data/licenses.json';

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository: string;
  publisher?: string;
  description?: string;
  isDirect: boolean;
  isRoot?: boolean;
  licenseText?: string;
}

const licensesList = rawLicensesData as LicenseEntry[];

interface LicensesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LicensesModal: React.FC<LicensesModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'direct' | 'all'>('direct');
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({
    mediabox: true, // open mediabox license by default
  });
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const toggleExpand = (name: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleCopy = (name: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedName(name);
    setTimeout(() => {
      setCopiedName((curr) => (curr === name ? null : curr));
    }, 2000);
  };

  const directCount = useMemo(
    () => licensesList.filter((p) => p.isDirect).length,
    []
  );

  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return licensesList.filter((pkg) => {
      if (activeTab === 'direct' && !pkg.isDirect) {
        return false;
      }
      if (!query) return true;
      return (
        pkg.name.toLowerCase().includes(query) ||
        pkg.license.toLowerCase().includes(query) ||
        (pkg.publisher && pkg.publisher.toLowerCase().includes(query)) ||
        (pkg.description && pkg.description.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, activeTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden border border-border bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/80">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Scale className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold tracking-wide">
              Open Source Licenses
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            mediabox is powered by open source software. Attribution, copyright notices, and license terms for all libraries.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar: Search and Filter Tabs */}
        <div className="p-4 border-b border-border/60 bg-muted/10 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as 'direct' | 'all')}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-2 w-full sm:w-80">
                <TabsTrigger value="direct" className="text-xs">
                  Direct ({directCount})
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  All ({licensesList.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search packages, licenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 text-xs bg-background/80"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y-0">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileCode2 className="h-10 w-10 stroke-1 mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">No matching packages found</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Try searching for a different keyword or switch to &quot;All&quot; tab.
              </p>
            </div>
          ) : (
            filteredList.map((pkg) => {
              const isExpanded = !!expandedPackages[pkg.name];
              const isCopied = copiedName === pkg.name;

              if (pkg.isRoot) {
                // Highlighted Card for mediabox (Host App)
                return (
                  <div
                    key={pkg.name}
                    className="relative p-4 rounded-lg border border-primary/40 bg-primary/5 transition-all shadow-sm"
                  >
                    <CornerEdges size={8} glow={true} telemetry="CPAL.1.0" />
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
                          <Badge variant="outline" className="border-primary text-primary text-[10px] font-mono">
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
                            onClick={() => toggleExpand(pkg.name)}
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
                      <span className="text-primary font-bold">Attribution Requirement:</span> You must include the prominent display of the phrase &ldquo;Powered by boredkevin/mediabox&rdquo; in the user interface of any Deployment or Derivative Work.
                    </div>

                    {/* Full License Text */}
                    {isExpanded && pkg.licenseText && (
                      <div className="mt-3 pt-3 border-t border-primary/20">
                        <div className="flex items-center justify-between pb-1.5">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            Full License Agreement (CPAL-1.0)
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(pkg.name, pkg.licenseText!)}
                            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <pre className="p-3 bg-background/90 border border-border/80 rounded text-[11px] font-mono whitespace-pre-wrap text-muted-foreground max-h-56 overflow-y-auto leading-relaxed selection:bg-primary/30">
                          {pkg.licenseText}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              }

              // Standard Dependency Card
              return (
                <div
                  key={pkg.name}
                  className="p-3.5 rounded-md border border-border/70 bg-card/40 hover:border-border transition-colors"
                >
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
                              ? 'border-primary/50 text-primary'
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
                          onClick={() => toggleExpand(pkg.name)}
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
                          onClick={() => handleCopy(pkg.name, pkg.licenseText!)}
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
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between p-4 border-t border-border/80 bg-muted/10 sm:justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            Showing {filteredList.length} of {licensesList.length} packages
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
