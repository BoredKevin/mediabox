# Form Pattern

This pattern demonstrates accessible form inputs with labels, helper captions, chamfer matching, and validation states.

```tsx
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Button,
} from '@boredkevin/ui';
import { Loader2, KeyRound } from 'lucide-react';

export function NodeAuthForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <Card telemetry="AUTH.01" className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary font-mono text-xs">
          <KeyRound className="h-4 w-4" />
          <span>Security Protocol</span>
        </div>
        <CardTitle>Authorize Terminal Node</CardTitle>
        <CardDescription>
          Enter your operator identifier and secure access token.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="operator-id" className="text-sm font-medium text-foreground">
              Operator Identifier
            </label>
            <Input
              id="operator-id"
              placeholder="OP-8821"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="access-token" className="text-sm font-medium text-foreground">
              Access Token
            </label>
            <Input
              id="access-token"
              type="password"
              placeholder="••••••••••••••••"
              required
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">
              Token must have elevated read/write clearance.
            </p>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button variant="outline" type="button" className="w-full" disabled={loading}>
            Cancel
          </Button>
          <Button variant="cyber" type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Authenticating...' : 'Connect Node'}</span>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```
