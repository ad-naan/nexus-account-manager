import { invoke } from '@tauri-apps/api/core'
import { useDeferredValue, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  Download,
  Edit,
  FileJson,
  HardDriveDownload,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Upload,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AccountCard } from '@/components/accounts/AccountCardBase'
import {
  AccountDetailsDialog,
  DetailGrid,
  DetailRow,
} from '@/components/accounts/AccountDetailsDialogBase'
import { AccountSearch } from '@/components/accounts/AccountSearch'
import { AccountTable } from '@/components/accounts/AccountTable'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { usePlatformVersions } from '@/hooks/usePlatformVersions'
import { cn } from '@/lib/utils'
import { usePlatformStore } from '@/stores/usePlatformStore'
import type { GenericAccount } from '@/types/account'
import type { AddMethodConfig, AddMethodProps, PlatformConfig } from '@/types/platform'

type ViewMode = 'grid' | 'list'
type Status = 'idle' | 'processing' | 'success' | 'error'

export interface ExternalPlatformDefinition {
  id: string
  name: string
  description: string
  color: string
  icon: LucideIcon
  accountTypeLabel?: string
  importHint?: string
  placeholderJson?: string
  importLocalCommand?: string
  switchCommand?: string
  localImportLabel?: string
  localImportDescription?: string
}

interface ExternalAccountFormProps {
  definition: ExternalPlatformDefinition
  initialAccount?: GenericAccount | null
  submitLabel: string
  onSubmit: (account: GenericAccount) => Promise<void> | void
  onSuccess?: () => void
}

interface ExternalMethodDialogProps {
  definition: ExternalPlatformDefinition
  methods: AddMethodConfig[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (account: GenericAccount) => Promise<void>
}

const defaultPlaceholderJson = `{
  "accessToken": "your-token",
  "refreshToken": "optional-refresh-token",
  "profile": {
    "email": "name@example.com"
  }
}`

function ensureObjectConfig(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON must be an object')
  }

  return value as Record<string, any>
}

function parseJsonSafely(value: string): Record<string, any> {
  return ensureObjectConfig(JSON.parse(value))
}

function pickText(candidates: unknown[]): string {
  const match = candidates.find((value) => typeof value === 'string' && value.trim())
  return typeof match === 'string' ? match.trim() : ''
}

function extractSuggestedEmail(config?: Record<string, any>): string {
  return pickText([
    config?.email,
    config?.username,
    config?.login,
    config?.githubLogin,
    config?.user?.email,
    config?.user?.login,
    config?.profile?.email,
    config?.account?.email,
    config?.account?.label,
    config?.session?.account?.label,
  ])
}

function extractSuggestedName(config?: Record<string, any>): string {
  return pickText([
    config?.name,
    config?.displayName,
    config?.githubName,
    config?.user?.name,
    config?.profile?.name,
    config?.profile?.displayName,
    config?.account?.name,
    config?.session?.account?.label,
  ])
}

function extractSuggestedProviderId(config?: Record<string, any>): string {
  return pickText([
    config?.providerId,
    config?.type,
    config?.membershipType,
    config?.stripeMembershipType,
    config?.subscriptionType,
    config?.plan,
    config?.tier,
  ])
}

function prettyConfig(value?: Record<string, any>): string {
  return JSON.stringify(value || {}, null, 2)
}

function buildExternalAccount(params: {
  definition: ExternalPlatformDefinition
  config: Record<string, any>
  initialAccount?: GenericAccount | null
  email?: string
  name?: string
  providerId?: string
  notes?: string
  source?: string
}): GenericAccount {
  const {
    definition,
    config,
    initialAccount = null,
    email,
    name,
    providerId,
    notes,
    source,
  } = params

  const resolvedEmail = (email || '').trim() || extractSuggestedEmail(config)
  if (!resolvedEmail) {
    throw new Error(`${definition.name} account identity not found`)
  }

  return {
    id: initialAccount?.id || crypto.randomUUID(),
    platform: definition.id,
    email: resolvedEmail,
    name: (name || '').trim() || extractSuggestedName(config) || definition.name,
    isActive: initialAccount?.isActive || false,
    lastUsedAt: initialAccount?.lastUsedAt || Date.now(),
    createdAt: initialAccount?.createdAt || Date.now(),
    providerId:
      (providerId || '').trim() ||
      extractSuggestedProviderId(config) ||
      definition.accountTypeLabel ||
      undefined,
    config,
    notes: notes?.trim() || initialAccount?.notes || undefined,
    source: source || initialAccount?.source || 'json',
  }
}

function ExternalAccountForm({
  definition,
  initialAccount = null,
  submitLabel,
  onSubmit,
  onSuccess,
}: ExternalAccountFormProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(initialAccount?.email || '')
  const [name, setName] = useState(initialAccount?.name || '')
  const [providerId, setProviderId] = useState(initialAccount?.providerId || '')
  const [notes, setNotes] = useState(initialAccount?.notes || '')
  const [rawJson, setRawJson] = useState(
    initialAccount?.config
      ? prettyConfig(initialAccount.config)
      : definition.placeholderJson || defaultPlaceholderJson,
  )
  const [jsonError, setJsonError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = parseJsonSafely(await file.text())
      setRawJson(JSON.stringify(parsed, null, 2))
      setJsonError('')

      if (!email.trim()) setEmail(extractSuggestedEmail(parsed))
      if (!name.trim()) setName(extractSuggestedName(parsed))
      if (!providerId.trim()) setProviderId(extractSuggestedProviderId(parsed))
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON file')
    } finally {
      event.target.value = ''
    }
  }

  const handleSubmit = async () => {
    setStatus('processing')
    setMessage('')

    try {
      const parsed = parseJsonSafely(rawJson)
      const nextAccount = buildExternalAccount({
        definition,
        config: parsed,
        initialAccount,
        email,
        name,
        providerId,
        notes,
      })

      await onSubmit(nextAccount)
      setJsonError('')
      setStatus('success')
      setMessage(
        initialAccount
          ? t('common.success', { defaultValue: 'Saved successfully' })
          : t('accounts.addSuccess', { defaultValue: 'Account added successfully' }),
      )
      onSuccess?.()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to save account')
      if (error instanceof SyntaxError) {
        setJsonError(error.message)
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm font-medium">{definition.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {definition.importHint || definition.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${definition.id}-email`}>
            {t('common.email', { defaultValue: 'Email' })}{' '}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${definition.id}-email`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            disabled={status === 'processing'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${definition.id}-name`}>
            {t('common.name', { defaultValue: 'Name' })}
          </Label>
          <Input
            id={`${definition.id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={definition.name}
            disabled={status === 'processing'}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${definition.id}-provider`}>
            {t('common.type', { defaultValue: 'Type' })}
          </Label>
          <Input
            id={`${definition.id}-provider`}
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            placeholder={definition.accountTypeLabel || 'Imported'}
            disabled={status === 'processing'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${definition.id}-notes`}>
            {t('common.details', { defaultValue: 'Notes' })}
          </Label>
          <Input
            id={`${definition.id}-notes`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('common.details', { defaultValue: 'Notes' })}
            disabled={status === 'processing'}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor={`${definition.id}-json`}>
            JSON <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === 'processing'}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import File
            </Button>
          </div>
        </div>

        <Textarea
          id={`${definition.id}-json`}
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          className="min-h-[240px] resize-y font-mono text-xs"
          placeholder={definition.placeholderJson || defaultPlaceholderJson}
          disabled={status === 'processing'}
        />

        {jsonError && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {jsonError}
          </div>
        )}
      </div>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            status === 'success' && 'bg-green-500/10 text-green-600',
            status === 'error' && 'bg-red-500/10 text-red-600',
            status === 'processing' && 'bg-blue-500/10 text-blue-600',
          )}
        >
          {status === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-4 w-4" />}
          <span>{message}</span>
        </div>
      )}

      <Button className="w-full" onClick={handleSubmit} disabled={status === 'processing'}>
        {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  )
}

function createExternalJsonMethod(definition: ExternalPlatformDefinition) {
  return function ExternalJsonMethod(props: AddMethodProps) {
    const { t } = useTranslation()

    return (
      <ExternalAccountForm
        definition={definition}
        submitLabel={t('accounts.add', { defaultValue: 'Add Account' })}
        onSubmit={async (account) => {
          props.onSuccess(account)
          props.onClose()
        }}
      />
    )
  }
}

function createExternalLocalImportMethod(definition: ExternalPlatformDefinition) {
  return function ExternalLocalImportMethod(props: AddMethodProps) {
    const { t } = useTranslation()
    const [status, setStatus] = useState<Status>('idle')
    const [message, setMessage] = useState('')

    const handleImport = async () => {
      if (!definition.importLocalCommand || status === 'processing') return

      setStatus('processing')
      setMessage('')

      try {
        const config = ensureObjectConfig(
          await invoke<Record<string, any>>(definition.importLocalCommand),
        )
        const account = buildExternalAccount({
          definition,
          config,
          source: 'local',
        })

        props.onSuccess(account)
        setStatus('success')
        setMessage(`${definition.name} local account imported`)
        props.onClose()
      } catch (error) {
        setStatus('error')
        setMessage(
          error instanceof Error
            ? error.message
            : `Failed to import ${definition.name} local account`,
        )
      }
    }

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {definition.localImportLabel || `Import current ${definition.name} account`}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {definition.localImportDescription ||
                `Read the current ${definition.name} login state from this machine and save it into Nexus.`}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              status === 'success' && 'bg-green-500/10 text-green-600',
              status === 'error' && 'bg-red-500/10 text-red-600',
              status === 'processing' && 'bg-blue-500/10 text-blue-600',
            )}
          >
            {status === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-4 w-4" />}
            <span>{message}</span>
          </div>
        )}

        <Button className="w-full" onClick={handleImport} disabled={status === 'processing'}>
          {status === 'processing' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <HardDriveDownload className="mr-2 h-4 w-4" />
          )}
          {t('common.import', { defaultValue: 'Import' })}
        </Button>
      </div>
    )
  }
}

function createExternalAddMethods(definition: ExternalPlatformDefinition): AddMethodConfig[] {
  const methods: AddMethodConfig[] = []

  if (definition.importLocalCommand) {
    methods.push({
      id: 'import',
      name: '本机导入',
      description:
        definition.localImportDescription ||
        `Import the current ${definition.name} session from local state storage.`,
      icon: HardDriveDownload,
      component: createExternalLocalImportMethod(definition),
    })
  }

  methods.push({
    id: 'json',
    name: 'JSON 导入',
    description: definition.importHint || definition.description,
    icon: FileJson,
    component: createExternalJsonMethod(definition),
  })

  return methods
}

function ExternalAccountEditorDialog({
  account,
  definition,
  open,
  onClose,
}: {
  account: GenericAccount | null
  definition: ExternalPlatformDefinition
  open: boolean
  onClose: () => void
}) {
  const updateAccount = usePlatformStore((state) => state.updateAccount)
  const loadAllAccounts = usePlatformStore((state) => state.loadAllAccounts)
  const { t } = useTranslation()

  if (!account) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {t('common.edit', { defaultValue: 'Edit' })} {definition.name}
          </DialogTitle>
        </DialogHeader>

        <ExternalAccountForm
          definition={definition}
          initialAccount={account}
          submitLabel={t('common.save', { defaultValue: 'Save' })}
          onSubmit={async (nextAccount) => {
            await updateAccount(account.id, nextAccount)
            await loadAllAccounts()
          }}
          onSuccess={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExternalAccountDetailsDialog({
  account,
  definition,
  open,
  onClose,
}: {
  account: GenericAccount
  definition: ExternalPlatformDefinition
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <AccountDetailsDialog
      open={open}
      onClose={onClose}
      title={account.name || definition.name}
      subtitle={account.email}
      badges={
        <>
          <Badge variant="outline">{definition.name}</Badge>
          {account.providerId && <Badge variant="secondary">{account.providerId}</Badge>}
          {account.source && <Badge variant="secondary">{account.source}</Badge>}
        </>
      }
      sections={[
        {
          title: t('common.details', { defaultValue: 'Details' }),
          icon: <Info className="h-4 w-4 text-muted-foreground" />,
          content: (
            <DetailGrid columns={2}>
              <DetailRow
                label={t('common.email', { defaultValue: 'Email' })}
                value={account.email}
                copyable
              />
              <DetailRow
                label={t('common.name', { defaultValue: 'Name' })}
                value={account.name || '-'}
              />
              <DetailRow
                label={t('common.type', { defaultValue: 'Type' })}
                value={account.providerId || 'Imported'}
              />
              <DetailRow
                label={t('common.status', { defaultValue: 'Status' })}
                value={account.isActive ? 'Active' : 'Inactive'}
              />
              <DetailRow
                label={t('common.createdAt', { defaultValue: 'Created' })}
                value={new Date(account.createdAt).toLocaleString()}
              />
              <DetailRow
                label={t('common.lastUsed', { defaultValue: 'Last Used' })}
                value={new Date(account.lastUsedAt).toLocaleString()}
              />
            </DetailGrid>
          ),
        },
        {
          title: 'JSON',
          icon: <FileJson className="h-4 w-4 text-muted-foreground" />,
          content: (
            <pre className="max-h-[320px] overflow-auto rounded-lg border border-border/60 bg-muted/30 p-4 text-xs leading-6">
              <code>{prettyConfig(account.config)}</code>
            </pre>
          ),
        },
      ]}
    />
  )
}

function ExternalAccountCard({
  account,
  definition,
  onEdit,
  onExport,
  onSwitch,
  isSwitching = false,
}: {
  account: GenericAccount
  definition: ExternalPlatformDefinition
  onEdit: (account: GenericAccount) => void
  onExport: (account: GenericAccount) => void
  onSwitch?: (account: GenericAccount) => void
  isSwitching?: boolean
}) {
  const { t } = useTranslation()
  const deleteAccount = usePlatformStore((state) => state.deleteAccount)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <AccountCard
        id={account.id}
        email={account.email}
        name={account.name}
        isActive={account.isActive}
        onSwitch={onSwitch ? () => onSwitch(account) : undefined}
        isSwitching={isSwitching}
        badges={
          <>
            <Badge variant="outline" className="text-[10px]">
              {definition.name}
            </Badge>
            {account.providerId && (
              <Badge variant="secondary" className="text-[10px]">
                {account.providerId}
              </Badge>
            )}
          </>
        }
        content={
          <div className="space-y-2 text-xs text-muted-foreground">
            {account.notes && <p className="line-clamp-2">{account.notes}</p>}
            <p className="truncate">Updated {new Date(account.lastUsedAt).toLocaleString()}</p>
          </div>
        }
        onExport={() => onExport(account)}
        onDetails={() => setDetailsOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        customActions={[
          {
            icon: Edit,
            label: t('common.edit', { defaultValue: 'Edit' }),
            onClick: () => onEdit(account),
          },
        ]}
      />

      <ExternalAccountDetailsDialog
        account={account}
        definition={definition}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('common.delete', { defaultValue: 'Delete' })}
        description={t('common.confirmDelete', {
          name: account.email,
          defaultValue: `Delete ${account.email}?`,
        })}
        confirmText={t('common.delete', { defaultValue: 'Delete' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        variant="destructive"
        onConfirm={async () => {
          await deleteAccount(account.id)
          toast.success(t('common.deleteSuccess', { defaultValue: 'Account deleted' }))
        }}
      />
    </>
  )
}

function ExternalMethodDialog({
  definition,
  methods,
  open,
  onOpenChange,
  onSuccess,
}: ExternalMethodDialogProps) {
  const { t } = useTranslation()
  const [selectedMethod, setSelectedMethod] = useState<string | null>(methods[0]?.id || null)

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => setSelectedMethod(methods[0]?.id || null), 150)
  }

  const method = methods.find((item) => item.id === selectedMethod) || methods[0]
  const MethodComponent = method?.component

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {t('accounts.add', { defaultValue: 'Add Account' })} {definition.name}
          </DialogTitle>
        </DialogHeader>

        {methods.length > 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {methods.map((item) => {
              const Icon = item.icon
              const isActive = item.id === selectedMethod

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMethod(item.id)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all',
                    isActive
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border/60 bg-background/70 hover:border-primary/40 hover:shadow-sm',
                  )}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className={cn(
                        'rounded-lg p-2',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {MethodComponent ? (
          <MethodComponent
            platform={definition.id}
            onSuccess={(account) => void onSuccess(account as GenericAccount)}
            onError={(error) => toast.error(error)}
            onClose={handleClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ExternalAddAccountDialog({ definition }: { definition: ExternalPlatformDefinition }) {
  const accounts = usePlatformStore((state) => state.accounts)
  const addAccount = usePlatformStore((state) => state.addAccount)
  const updateAccount = usePlatformStore((state) => state.updateAccount)
  const loadAllAccounts = usePlatformStore((state) => state.loadAllAccounts)
  const platformAccounts = useMemo(
    () =>
      accounts.filter(
        (account): account is GenericAccount => account.platform === definition.id,
      ),
    [accounts, definition.id],
  )
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const methods = useMemo(() => createExternalAddMethods(definition), [definition])

  const handleSuccess = async (account: GenericAccount) => {
    const existingAccount = platformAccounts.find(
      (item) => item.email.toLowerCase() === account.email.toLowerCase(),
    )

    if (account.source === 'local') {
      await Promise.all(
        platformAccounts
          .filter((item) => item.isActive && item.id !== (existingAccount?.id || account.id))
          .map((item) => updateAccount(item.id, { isActive: false })),
      )
    }

    const nextAccountBase =
      account.source === 'local'
        ? { ...account, isActive: true, lastUsedAt: Date.now() }
        : account

    const nextAccount = existingAccount
      ? { ...nextAccountBase, id: existingAccount.id, createdAt: existingAccount.createdAt }
      : nextAccountBase

    if (existingAccount) {
      await updateAccount(existingAccount.id, nextAccount)
    } else {
      await addAccount(nextAccount)
    }

    await loadAllAccounts()
    setOpen(false)
  }

  return (
    <>
      <Button variant="default" className="shadow-sm" onClick={() => setOpen(true)}>
        <FileJson className="mr-2 h-4 w-4" />
        {t('accounts.add', { defaultValue: 'Add Account' })}
      </Button>

      <ExternalMethodDialog
        definition={definition}
        methods={methods}
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  )
}

function ExternalPlatformAccountList({ definition }: { definition: ExternalPlatformDefinition }) {
  const { t } = useTranslation()
  const accounts = usePlatformStore((state) => state.accounts)
  const updateAccount = usePlatformStore((state) => state.updateAccount)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportAccounts, setExportAccounts] = useState<GenericAccount[] | null>(null)
  const [editAccount, setEditAccount] = useState<GenericAccount | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const { versions, loading: versionsLoading } = usePlatformVersions()

  const platformAccounts = useMemo(
    () => accounts.filter((account): account is GenericAccount => account.platform === definition.id),
    [accounts, definition.id],
  )

  const methods = useMemo(() => createExternalAddMethods(definition), [definition])

  const filteredAccounts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return platformAccounts

    return platformAccounts.filter((account) =>
      [account.email, account.name, account.providerId, account.notes].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    )
  }, [deferredSearchQuery, platformAccounts])

  const version = versions.find((item) => item.platform === definition.id)
  const canSwitchAccounts = Boolean(definition.switchCommand)

  const handleSwitchAccount = async (account: GenericAccount) => {
    if (!definition.switchCommand || isSwitching) return
    if (!account.config) {
      toast.error(`${definition.name} configuration not found`)
      return
    }

    setIsSwitching(true)

    try {
      await invoke(definition.switchCommand, { settings: JSON.stringify(account.config) })

      await Promise.all(
        platformAccounts
          .filter((item) => item.id !== account.id && item.isActive)
          .map((item) => updateAccount(item.id, { isActive: false })),
      )
      await updateAccount(account.id, { isActive: true, lastUsedAt: Date.now() })

      toast.success(`${definition.name} account switched successfully`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to switch ${definition.name} account`,
      )
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">{definition.name}</h2>
            {versionsLoading ? (
              <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {t('common.loading', { defaultValue: 'Loading...' })}
              </span>
            ) : version ? (
              version.installed ? (
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {version.version
                    ? `v${version.version}`
                    : t('common.installed', { defaultValue: 'Installed' })}
                </span>
              ) : (
                <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  {t('common.notInstalled', { defaultValue: 'Not installed' })}
                </span>
              )
            ) : (
              <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {methods.length > 1 ? 'Multiple add methods' : 'JSON'}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-lg font-light text-muted-foreground">
            {definition.description}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end xl:w-auto">
          {platformAccounts.length > 0 && (
            <>
              <AccountSearch
                value={searchQuery}
                onChange={setSearchQuery}
                resultCount={filteredAccounts.length}
                className="w-full md:w-72"
              />
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-background/50 p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 px-2"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportAccounts(null)
                  setExportOpen(true)
                }}
                className="w-full md:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('common.export', { defaultValue: 'Export' })}
              </Button>
            </>
          )}
          <ExternalAddAccountDialog definition={definition} />
        </div>
      </div>

      {platformAccounts.length === 0 ? (
        <Card className="border-dashed border-2 border-muted bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 rounded-full bg-background/50 p-4 ring-1 ring-white/10">
              <definition.icon className="h-8 w-8" />
            </div>
            <p className="mb-2 text-lg font-medium">
              {t('accounts.noAccounts', { defaultValue: 'No accounts yet' })}
            </p>
            <p className="mb-6 max-w-xl text-center text-sm text-muted-foreground">
              {definition.importHint || definition.description}
            </p>
            <ExternalAddAccountDialog definition={definition} />
          </CardContent>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        <Card className="border-dashed border-2 border-muted bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">
              {t('common.noResults', { defaultValue: 'No results found' })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('common.tryDifferentSearch', { defaultValue: 'Try a different search term' })}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAccounts.map((account) => (
            <ExternalAccountCard
              key={account.id}
              account={account}
              definition={definition}
              onEdit={setEditAccount}
              onExport={(currentAccount) => {
                setExportAccounts([currentAccount])
                setExportOpen(true)
              }}
              onSwitch={canSwitchAccounts ? handleSwitchAccount : undefined}
              isSwitching={isSwitching}
            />
          ))}
        </div>
      ) : (
        <AccountTable
          accounts={filteredAccounts}
          onSwitch={canSwitchAccounts ? handleSwitchAccount : undefined}
          onEdit={(account) => setEditAccount(account as GenericAccount)}
          isSwitching={isSwitching}
        />
      )}

      <ExternalAccountEditorDialog
        account={editAccount}
        definition={definition}
        open={Boolean(editAccount)}
        onClose={() => setEditAccount(null)}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => {
          setExportOpen(false)
          setExportAccounts(null)
        }}
        accounts={exportAccounts || platformAccounts}
      />
    </div>
  )
}

export function createExternalPlatformConfig(
  definition: ExternalPlatformDefinition,
): PlatformConfig {
  const AccountList = () => <ExternalPlatformAccountList definition={definition} />

  return {
    id: definition.id,
    name: definition.name,
    icon: definition.icon,
    color: definition.color,
    description: definition.description,
    AccountList,
    features: {
      quota: false,
      autoRefresh: false,
      machineId: false,
    },
    addMethods: createExternalAddMethods(definition),
  }
}
