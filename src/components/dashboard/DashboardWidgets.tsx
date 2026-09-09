import {
  EmploymentMetricStrip,
  EmploymentStatusCard,
} from './EmploymentWidgets'
import { TeamPerformanceCard } from './TeamPerformanceCard'
import { ProjectTrackCard, TaskOverviewCard } from './ProjectTrack'

/** Shared top-of-dashboard widgets for Admin / Team Leader */
export function LeadDashboardWidgets() {
  return (
    <div className="space-y-4">
      <EmploymentMetricStrip />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <TaskOverviewCard />
        </div>
        <div className="xl:col-span-4">
          <ProjectTrackCard />
        </div>
        <div className="xl:col-span-4 space-y-4">
          <TeamPerformanceCard />
          <EmploymentStatusCard />
        </div>
      </div>
    </div>
  )
}

export function UserDashboardWidgets() {
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-5">
        <TaskOverviewCard />
      </div>
      <div className="xl:col-span-7">
        <ProjectTrackCard />
      </div>
    </div>
  )
}
