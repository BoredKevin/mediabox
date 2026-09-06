# Dashboard Page Pattern

This pattern demonstrates how to assemble a complete sci-fi SaaS dashboard with a sidebar, telemetry cards, dynamic background, and activity table.

```tsx
import React from 'react';
import {
  ThemeProvider,
  CanvasBackground,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Avatar,
  AvatarFallback,
  Separator,
} from '@boredkevin/ui';
import {
  Activity,
  Cpu,
  Database,
  Radio,
  Settings,
  Shield,
  Terminal,
} from 'lucide-react';

export function DashboardPage() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-background text-foreground flex">
        {/* Unified Canvas Background */}
        <CanvasBackground />

        {/* Tactical Glass Sidebar */}
        <aside className="relative z-10 w-64 border-r border-border liquid-glass-panel p-4 flex flex-col justify-between hidden md:flex">
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
              <Radio className="h-5 w-5 text-primary animate-pulse" />
              <span className="font-bold tracking-widest text-sm uppercase">
                Matrix OS
              </span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                v0.1.1
              </Badge>
            </div>

            <nav className="space-y-1">
              <Button variant="cyber" className="w-full justify-start gap-2">
                <Activity className="h-4 w-4" />
                <span>Overview</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Terminal className="h-4 w-4" />
                <span>Console</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Database className="h-4 w-4" />
                <span>Nodes</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Shield className="h-4 w-4" />
                <span>Security</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Button>
            </nav>
          </div>

          <div className="p-2 border-t border-border flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>OP</AvatarFallback>
            </Avatar>
            <div className="text-xs">
              <div className="font-medium">Operator-01</div>
              <div className="text-muted-foreground">Admin Clearance</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="relative z-10 flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Telemetry</h1>
              <p className="text-sm text-muted-foreground">
                Live monitoring across all cluster nodes.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Export Data</Button>
              <Button variant="cyber" size="sm">Deploy Node</Button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card telemetry="SYS.01">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase">CPU Load</span>
                  <Cpu className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold font-mono">34.2%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="success">NOMINAL</Badge>
                  <span className="text-xs text-muted-foreground">16 Cores Active</span>
                </div>
              </CardContent>
            </Card>

            <Card telemetry="SYS.02">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Memory</span>
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold font-mono">18.4 GB</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">64 GB TOTAL</Badge>
                  <span className="text-xs text-muted-foreground">28% utilized</span>
                </div>
              </CardContent>
            </Card>

            <Card telemetry="SYS.03">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Throughput</span>
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold font-mono">2.8 GB/s</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="success">PEAK FLOW</Badge>
                  <span className="text-xs text-muted-foreground">↑ 14% vs avg</span>
                </div>
              </CardContent>
            </Card>

            <Card telemetry="SYS.04">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Cluster Health</span>
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold font-mono">99.98%</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="success">ONLINE</Badge>
                  <span className="text-xs text-muted-foreground">0 outages</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Table */}
          <Card>
            <CardHeader>
              <CardTitle>Active Nodes</CardTitle>
              <CardDescription>Real-time cluster telemetry stream.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node Identifier</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono font-medium">NODE-ALPHA-01</TableCell>
                    <TableCell>us-east-1</TableCell>
                    <TableCell><Badge variant="success">ONLINE</Badge></TableCell>
                    <TableCell className="font-mono">8ms</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Inspect</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono font-medium">NODE-BETA-02</TableCell>
                    <TableCell>eu-west-1</TableCell>
                    <TableCell><Badge variant="warning">SYNCING</Badge></TableCell>
                    <TableCell className="font-mono">42ms</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Inspect</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </ThemeProvider>
  );
}
```
