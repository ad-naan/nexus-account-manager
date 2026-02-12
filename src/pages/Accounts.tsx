import { useSearchParams } from 'react-router-dom'
import { getAllPlatforms, getPlatform } from '@/platforms/registry'
import { Button } from '@/components/ui/Button'

export function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedPlatformId = searchParams.get('platform') || getAllPlatforms()[0]?.id
  const selectedPlatform = getPlatform(selectedPlatformId)
  const platforms = getAllPlatforms()

  if (!selectedPlatform) {
    return <div>Platform not found</div>
  }

  const AccountListComponent = selectedPlatform.AccountList

  return (
    <div className="space-y-6">
      {/* Platform Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {platforms.map((platform) => {
          const Icon = platform.icon
          const isActive = platform.id === selectedPlatformId

          return (
            <Button
              key={platform.id}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSearchParams({ platform: platform.id })}
            >
              <Icon className="mr-2 h-4 w-4" />
              {platform.name}
            </Button>
          )
        })}
      </div>

      {/* Platform Content */}
      <AccountListComponent />
    </div>
  )
}
