import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building, MoreVertical, Shield, Loader2, Check } from "lucide-react";
import { AppRole } from "@/hooks/useUserRole";

interface MobileUserCardProps {
  userId: string;
  fullName: string;
  companyName: string | null;
  role: AppRole;
  isCurrentUser: boolean;
  isUpdating: boolean;
  onRoleChange: (userId: string, newRole: AppRole) => void;
}

const roleLabels: Record<AppRole, string> = {
  monter: "Montér",
  manager: "Projektový manažér",
  admin: "Administrátor",
  accountant: "Účtovník",
  director: "Riaditeľ",
};

const roleBadgeVariants: Record<AppRole, "default" | "secondary" | "destructive" | "outline"> = {
  monter: "secondary",
  manager: "default",
  admin: "destructive",
  accountant: "outline",
  director: "destructive",
};

const allRoles: AppRole[] = ["monter", "manager", "accountant", "admin", "director"];

export function MobileUserCard({
  userId,
  fullName,
  companyName,
  role,
  isCurrentUser,
  isUpdating,
  onRoleChange,
}: MobileUserCardProps) {
  const initials = fullName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate text-base">
                  {fullName}
                </h3>
                {companyName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                    <Building className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{companyName}</span>
                  </p>
                )}
              </div>

              {/* Actions Dropdown */}
              {!isCurrentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 flex-shrink-0"
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <MoreVertical className="h-5 w-5" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Zmeniť rolu
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {allRoles.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => onRoleChange(userId, r)}
                        className="flex items-center justify-between py-3"
                      >
                        <span>{roleLabels[r]}</span>
                        {role === r && <Check className="h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Role Badge */}
            <div className="mt-3">
              <Badge 
                variant={roleBadgeVariants[role]} 
                className="text-xs px-2.5 py-1"
              >
                {roleLabels[role]}
              </Badge>
              {isCurrentUser && (
                <span className="ml-2 text-xs text-muted-foreground">(Vy)</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
