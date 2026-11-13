/**
 * CipherShield — Emergency Access & Digital Inheritance Page
 */
import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  UserPlus,
  Clock,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function EmergencyPage() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [waitHours, setWaitHours] = useState(72);

  const loadContacts = async () => {
    try {
      const data = await apiClient<any[]>('/emergency/contacts');
      setContacts(data || []);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    await apiClient('/emergency/contacts', {
      method: 'POST',
      body: JSON.stringify({
        grantee_email: email,
        wait_time_hours: waitHours,
      }),
    });

    setEmail('');
    setModalOpen(false);
    loadContacts();
  };

  const handleRemove = async (id: string) => {
    await apiClient(`/emergency/contacts/${id}`, { method: 'DELETE' });
    loadContacts();
  };

  const handleApprove = async (id: string) => {
    await apiClient(`/emergency/contacts/${id}/approve`, { method: 'POST' });
    loadContacts();
  };

  const handleReject = async (id: string) => {
    await apiClient(`/emergency/contacts/${id}/reject`, { method: 'POST' });
    loadContacts();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HeartHandshake className="h-6 w-6 text-primary" />
            Emergency Access
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Designate trusted contacts who can request vault access with an enforced safety waiting period.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2 text-xs font-semibold">
          <UserPlus className="h-4 w-4" />
          Add Trusted Contact
        </Button>
      </div>

      <div className="p-6 rounded-2xl border bg-card/60 backdrop-blur-md space-y-4">
        <h3 className="font-bold text-sm text-foreground">Designated Contacts ({contacts.length})</h3>

        {contacts.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <HeartHandshake className="h-10 w-10 text-muted-foreground mx-auto stroke-1" />
            <p className="text-sm font-semibold text-foreground">No emergency contacts configured</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add a trusted spouse, attorney, or family member to ensure digital asset continuity.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((contact) => (
              <div key={contact.id} className="py-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{contact.contact_email}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {contact.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Waiting period: {contact.waiting_period_hours} hours</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {contact.status === 'pending_approval' && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(contact.id)}
                        className="text-xs bg-green-600 hover:bg-green-700"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(contact.id)}
                        className="text-xs"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(contact.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent onClose={() => setModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Designate Emergency Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Contact Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trusted@family.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Dispute Waiting Period (Hours)
              </label>
              <Input
                type="number"
                min={24}
                max={720}
                value={waitHours}
                onChange={(e) => setWaitHours(parseInt(e.target.value))}
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                You will be notified immediately upon request and can decline access within this timeframe.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Send Invitation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
