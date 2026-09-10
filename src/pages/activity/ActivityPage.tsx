import { useMemo } from 'react'
import { Activity } from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDateTime, exportCSVSimple } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  ExportDropdown,
} from '../../components/ui'

type ActivityEntityType =
  | 'client'
  | 'project'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'subscription'
  | 'salary'
  | 'settings'
  | 'employee'

type BadgeVariant =
  | 'purple'
  | 'blue'
  | 'success'
  | 'warning'
  | 'muted'

const entityTypeVariant: Record<
  ActivityEntityType,
  BadgeVariant
> = {
  client: 'purple',
  project: 'blue',
  invoice: 'success',
  payment: 'success',
  expense: 'warning',
  subscription: 'purple',
  salary: 'muted',
  settings: 'muted',
  employee: 'muted',
}

function getEntityVariant(
  entityType: string
): BadgeVariant {
  if (
    entityType in entityTypeVariant
  ) {
    return entityTypeVariant[
      entityType as ActivityEntityType
    ]
  }

  return 'muted'
}

function formatActivityDate(
  value: string
): string {
  try {
    return formatDateTime(value)
  } catch {
    return value
  }
}

export default function ActivityPage() {
  const { activityLogs, settings } = useData()
  const { success, error } = useToast()

  const sortedActivityLogs = useMemo(() => {
    return [...activityLogs].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()

      if (
        Number.isNaN(dateA) &&
        Number.isNaN(dateB)
      ) {
        return 0
      }

      if (Number.isNaN(dateA)) {
        return 1
      }

      if (Number.isNaN(dateB)) {
        return -1
      }

      return dateB - dateA
    })
  }, [activityLogs])

  const handleExportPDF = () => {
    if (sortedActivityLogs.length === 0) {
      error('No activity records to export.')
      return
    }

    try {
      generateReportPDF(
        'Activity Audit Log',
        `Showing ${sortedActivityLogs.length} activity event${sortedActivityLogs.length !== 1 ? 's' : ''}`,
        ['Timestamp', 'Action', 'Entity Type', 'Description / Details'],
        sortedActivityLogs.map((log) => [
          formatActivityDate(log.created_at),
          log.action,
          String(log.entity_type || 'system'),
          log.description || '—',
        ]),
        [
          { label: 'Total Events Logged', value: `${sortedActivityLogs.length}` },
        ],
        settings
      )
      success(`Exported ${sortedActivityLogs.length} log${sortedActivityLogs.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export activity PDF:', err)
      error('Failed to generate activity PDF.')
    }
  }

  const handleExportCSV = () => {
    if (sortedActivityLogs.length === 0) {
      error('No activity records to export.')
      return
    }

    try {
      exportCSVSimple(
        'activity-audit-log',
        ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Description'],
        sortedActivityLogs.map((log) => ({
          timestamp: log.created_at,
          action: log.action,
          entity_type: log.entity_type || '',
          entity_id: log.entity_id || '',
          description: log.description || '',
        }))
      )
      success(`Exported ${sortedActivityLogs.length} log${sortedActivityLogs.length !== 1 ? 's' : ''} to CSV.`)
    } catch (err) {
      console.error('Failed to export activity CSV:', err)
      error('Failed to export activity CSV.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle={`${activityLogs.length} recorded actions`}
        actions={
          <ExportDropdown
            onExportPDF={handleExportPDF}
            onExportCSV={handleExportCSV}
            disabled={sortedActivityLogs.length === 0}
          />
        }
      />

      <Card>
        {sortedActivityLogs.length === 0 ? (
          <EmptyState
            title="No activity"
            description="System actions will appear here."
            icon={Activity}
          />
        ) : (
          <div className="divide-y divide-xp-light-gray">
            {sortedActivityLogs.map((log) => {
              const entityType = String(
                log.entity_type || 'system'
              )

              return (
                <div
                  key={log.id}
                  className="
                    flex
                    items-start
                    gap-4
                    px-4
                    py-3.5
                    hover:bg-xp-off-white
                    transition-colors
                  "
                >
                  {/* Activity icon */}
                  <div
                    className="
                      w-8
                      h-8
                      rounded-full
                      bg-xp-light-purple
                      flex
                      items-center
                      justify-center
                      shrink-0
                      mt-0.5
                    "
                  >
                    <Activity
                      size={13}
                      className="text-xp-purple"
                    />
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#111]">
                        {log.action}
                      </p>

                      <Badge
                        variant={getEntityVariant(
                          entityType
                        )}
                      >
                        {entityType}
                      </Badge>
                    </div>

                    <p className="text-sm text-xp-muted mt-0.5">
                      {log.description}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span
                    className="
                      text-xs
                      text-xp-dark-muted
                      shrink-0
                      mt-0.5
                    "
                  >
                    {formatActivityDate(
                      log.created_at
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
  