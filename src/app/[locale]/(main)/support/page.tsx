"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeadphonesIcon, Plus, ChevronRight, Send } from "lucide-react";

// Mock tickets
const mockTickets = [
  {
    id: "1",
    subject: "Order delivery delay",
    status: "in_progress",
    priority: "high",
    created_at: "2024-01-14",
  },
  {
    id: "2",
    subject: "Invoice correction request",
    status: "resolved",
    priority: "medium",
    created_at: "2024-01-10",
  },
  {
    id: "3",
    subject: "Product inquiry",
    status: "open",
    priority: "low",
    created_at: "2024-01-08",
  },
];

export default function SupportPage() {
  const t = useTranslations("support");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "resolved":
        return "success";
      case "in_progress":
        return "warning";
      case "open":
        return "info";
      default:
        return "secondary";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit ticket
    console.log({ subject, description, priority });
    setShowNewTicket(false);
    setSubject("");
    setDescription("");
    setPriority("medium");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Button onClick={() => setShowNewTicket(!showNewTicket)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("newTicket")}
          </Button>
        </div>

        {/* New Ticket Form */}
        {showNewTicket && (
          <Card>
            <CardHeader>
              <CardTitle>{t("newTicket")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">{t("subject")}</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("description")}</Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("priority")}</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("priorities.low")}</SelectItem>
                      <SelectItem value="medium">
                        {t("priorities.medium")}
                      </SelectItem>
                      <SelectItem value="high">
                        {t("priorities.high")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">
                    <Send className="mr-1 h-4 w-4" />
                    {t("submit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewTicket(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tickets List */}
        {mockTickets.length === 0 ? (
          <div className="py-12 text-center">
            <HeadphonesIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("noTickets")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mockTickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        Created: {ticket.created_at}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(ticket.status) as any}>
                          {t(`statuses.${ticket.status}`)}
                        </Badge>
                        <Badge
                          variant={getPriorityVariant(ticket.priority) as any}
                        >
                          {t(`priorities.${ticket.priority}`)}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
