# Data Table Pattern

This pattern demonstrates a high-density data grid combined with search filtering, status badges, and row action dropdowns.

```tsx
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@boredkevin/ui';
import { Search, MoreHorizontal, Filter } from 'lucide-react';

const NODES_DATA = [
  { id: 'NODE-01', name: 'Primary Ingestion Core', status: 'online', load: '45%', region: 'us-east' },
  { id: 'NODE-02', name: 'Perlin Stream Processor', status: 'online', load: '78%', region: 'us-west' },
  { id: 'NODE-03', name: 'Constellation Relay', status: 'warning', load: '92%', region: 'eu-central' },
  { id: 'NODE-04', name: 'Aurora Buffer Node', status: 'offline', load: '0%', region: 'ap-southeast' },
];

export function NodesDataTable() {
  const [search, setSearch] = useState('');

  const filtered = NODES_DATA.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card telemetry="DATA.GRID">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Computational Nodes</CardTitle>
            <CardDescription>
              Cluster status, resource utilization, and regional assignments.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter nodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node ID</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Compute Load</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((node) => (
              <TableRow key={node.id}>
                <TableCell className="font-mono text-xs font-semibold">
                  {node.id}
                </TableCell>
                <TableCell className="text-sm">{node.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {node.region}
                </TableCell>
                <TableCell>
                  {node.status === 'online' && <Badge variant="success">ONLINE</Badge>}
                  {node.status === 'warning' && <Badge variant="warning">HIGH LOAD</Badge>}
                  {node.status === 'offline' && <Badge variant="destructive">OFFLINE</Badge>}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {node.load}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Node Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>View Telemetry</DropdownMenuItem>
                      <DropdownMenuItem>Restart Stream</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Terminate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```
