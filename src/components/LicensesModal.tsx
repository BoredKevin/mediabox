import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, Search, X, FileCode2 } from 'lucide-react';
import rawLicensesData from '@/data/licenses.json';
import { LicenseItemCard } from './licenses/LicenseItemCard';

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
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden border border-border bg-card shadow-2xl rounded-none">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground mb-1">
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
            filteredList.map((pkg) => (
              <LicenseItemCard
                key={pkg.name}
                pkg={pkg}
                isExpanded={!!expandedPackages[pkg.name]}
                onToggleExpand={() => toggleExpand(pkg.name)}
                isCopied={copiedName === pkg.name}
                onCopy={(text) => handleCopy(pkg.name, text)}
              />
            ))
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

export default LicensesModal;
