/**
 * CipherShield — Add / Edit Vault Item Modal Form
 */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter';
import { useVaultStore } from '@/stores/vaultStore';
import { useUIStore } from '@/stores/uiStore';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import type { ItemType, Folder } from '@/types/vault';

export interface VaultItemFormProps {
  item?: any;
  folders?: Folder[];
  onSave?: (savedItem: any) => void;
  onCancel?: () => void;
}

export function VaultItemForm({
  item: propItem,
  folders: propFolders,
  onSave: propOnSave,
  onCancel: propOnCancel,
}: VaultItemFormProps = {}) {
  const { itemFormOpen, itemFormMode, itemFormInitialData, closeItemForm } = useUIStore();
  const { addItem, updateItem, folders: storeFolders } = useVaultStore();

  const isControlled = Boolean(propOnCancel);
  const activeItem = propItem || itemFormInitialData;
  const isEdit = Boolean(activeItem?.id);
  const initialData = (activeItem?.decryptedData || activeItem?.data || activeItem || {}) as any;

  const folders = propFolders || storeFolders;

  const [type, setType] = useState<ItemType>(activeItem?.type || 'login');
  const [password, setPassword] = useState<string>(initialData.password || '');
  const [folderId, setFolderId] = useState<string | null>(activeItem?.folder_id || null);
  const [customFields, setCustomFields] = useState<any[]>(initialData.customFields || []);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      title: initialData.title || activeItem?.name || '',
      username: initialData.username || initialData.email || '',
      url: (initialData.urls && initialData.urls[0]) || initialData.uri || '',
      notes: initialData.notes || initialData.content || '',
      totp: initialData.totp || '',
      cardNumber: initialData.number || '',
      cardholder: initialData.cardholderName || '',
      expMonth: initialData.expMonth || '',
      expYear: initialData.expYear || '',
      cvv: initialData.cvv || '',
      ssid: initialData.ssid || '',
    },
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
    let res = '';
    const arr = new Uint8Array(24);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < 24; i++) {
      res += chars[arr[i] % chars.length];
    }
    setPassword(res);
  };

  const handleClose = () => {
    if (propOnCancel) {
      propOnCancel();
    } else {
      closeItemForm();
    }
  };

  const onSubmit = async (values: any) => {
    let itemData: any = {
      title: values.title,
      notes: values.notes,
      customFields,
    };

    if (type === 'login') {
      itemData = {
        ...itemData,
        username: values.username,
        password,
        urls: values.url ? [values.url] : [],
        totp: values.totp,
      };
    } else if (type === 'note' || type === 'secure_note') {
      itemData = {
        ...itemData,
        content: values.notes,
      };
    } else if (type === 'card' || type === 'credit_card') {
      itemData = {
        ...itemData,
        cardholderName: values.cardholder,
        number: values.cardNumber,
        expMonth: values.expMonth,
        expYear: values.expYear,
        cvv: values.cvv,
      };
    } else if (type === 'wifi') {
      itemData = {
        ...itemData,
        ssid: values.ssid,
        password,
      };
    } else {
      itemData = {
        ...itemData,
        password,
        key: password,
      };
    }

    if (propOnSave) {
      propOnSave({
        id: activeItem?.id,
        type,
        data: itemData,
        decryptedData: itemData,
        folder_id: folderId,
      });
    } else {
      if (isEdit && activeItem?.id) {
        await updateItem(activeItem.id, {
          type,
          data: itemData,
          folder_id: folderId,
        });
      } else {
        await addItem({
          type,
          data: itemData,
          folder_id: folderId,
        });
      }
      closeItemForm();
    }
  };

  const formContent = (
    <div className="p-6 space-y-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Vault Item' : 'New Vault Item'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
        {/* Type Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Item Type</label>
            <Select value={type} onValueChange={(val: any) => setType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="note">Secure Note</SelectItem>
                <SelectItem value="card">Credit Card</SelectItem>
                <SelectItem value="wifi">Wi-Fi</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Folder</label>
            <Select value={folderId || 'none'} onValueChange={(val) => setFolderId(val === 'none' ? null : val)}>
              <SelectTrigger>
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Title</label>
          <Input {...register('title', { required: true })} placeholder="e.g. GitHub, AWS, Personal Note" />
        </div>

        {/* Dynamic Fields for Login */}
        {type === 'login' && (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Username / Email</label>
              <Input {...register('username')} placeholder="username@example.com" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground">Password</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateRandomPassword}
                  className="h-6 text-xs text-primary gap-1"
                >
                  <KeyRound className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="font-mono text-sm"
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Website URL</label>
              <Input {...register('url')} placeholder="https://example.com" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">TOTP Secret (optional)</label>
              <Input {...register('totp')} placeholder="Base32 key (e.g. JBSWY3DPEHPK3PXP)" className="font-mono text-xs" />
            </div>
          </>
        )}

        {/* Dynamic Fields for Card */}
        {(type === 'card' || type === 'credit_card') && (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Cardholder Name</label>
              <Input {...register('cardholder')} placeholder="Full Name on Card" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Card Number</label>
              <Input {...register('cardNumber')} placeholder="•••• •••• •••• ••••" className="font-mono" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Exp Month</label>
                <Input {...register('expMonth')} placeholder="MM" maxLength={2} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Exp Year</label>
                <Input {...register('expYear')} placeholder="YYYY" maxLength={4} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">CVV</label>
                <Input {...register('cvv')} placeholder="•••" maxLength={4} />
              </div>
            </div>
          </>
        )}

        {/* Dynamic Fields for Wi-Fi */}
        {type === 'wifi' && (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">SSID / Network Name</label>
              <Input {...register('ssid')} placeholder="My Home Network" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Wi-Fi Password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Secure Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Encrypted notes..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">
            {isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );

  if (isControlled) {
    return formContent;
  }

  return (
    <Dialog open={itemFormOpen} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-lg p-0">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
