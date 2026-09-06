# Settings Page Pattern

This pattern demonstrates how to compose a settings configuration panel using `Tabs`, `Card`, `Input`, `Switch`, `Slider`, and `Button`.

```tsx
import React from 'react';
import {
  ThemeProvider,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  Switch,
  Slider,
  Button,
  Separator,
} from '@boredkevin/ui';

export function SettingsPage() {
  return (
    <ThemeProvider>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure system parameters, visual atmosphere, and access keys.
          </p>
        </div>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="appearance">Atmosphere</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="pt-4">
            <Card telemetry="THEME.CFG">
              <CardHeader>
                <CardTitle>Atmosphere & Theming</CardTitle>
                <CardDescription>
                  Tune liquid-glass material and HUD bracket parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="glass-toggle" className="text-sm font-medium">
                      Liquid Glass Material
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Frosted backdrop blur on card panels
                    </p>
                  </div>
                  <Switch id="glass-toggle" defaultChecked />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Backdrop Blur Depth</span>
                    <span className="font-mono text-muted-foreground">16px</span>
                  </div>
                  <Slider defaultValue={[16]} max={32} min={4} step={2} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="hud-toggle" className="text-sm font-medium">
                      Corner Edge Lines
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Neon L-bracket telemetry markers on cards
                    </p>
                  </div>
                  <Switch id="hud-toggle" defaultChecked />
                </div>
              </CardContent>
              <CardFooter className="gap-2 justify-end">
                <Button variant="outline">Reset Defaults</Button>
                <Button variant="cyber">Save Appearance</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="pt-4">
            <Card telemetry="GEN.CFG">
              <CardHeader>
                <CardTitle>Node Configuration</CardTitle>
                <CardDescription>
                  Basic identification and cluster assignment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="node-name" className="text-sm font-medium">
                    Node Name
                  </label>
                  <Input id="node-name" defaultValue="matrix-core-01" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="endpoint" className="text-sm font-medium">
                    Telemetry Ingestion Endpoint
                  </label>
                  <Input id="endpoint" defaultValue="https://telemetry.matrix.io/v1" />
                </div>
              </CardContent>
              <CardFooter className="gap-2 justify-end">
                <Button variant="cyber">Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ThemeProvider>
  );
}
```
