import { ArrowUpRight } from 'lucide-react'

const metrics = [
  {
    title: 'Total Projects',
    value: '24',
    note: '5%',
    suffix: 'increased from last month',
    featured: true,
  },
  {
    title: 'Ended Projects',
    value: '10',
    note: '6%',
    suffix: 'increased from last month',
    featured: false,
  },
  {
    title: 'Running Projects',
    value: '12',
    note: '2%',
    suffix: 'increased from last month',
    featured: false,
  },
  {
    title: 'Pending Project',
    value: '2',
    note: '',
    suffix: 'On Discuss',
    featured: false,
  },
]

export default function MetricCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <article
          key={m.title}
          className={`relative overflow-hidden rounded-[22px] p-5 shadow-card ${
            m.featured
              ? 'bg-cs-forest text-white'
              : 'border border-white bg-white text-cs-ink'
          }`}
        >
          <div className="mb-6 flex items-start justify-between">
            <p
              className={`text-[14px] font-medium ${
                m.featured ? 'text-white/90' : 'text-cs-ink'
              }`}
            >
              {m.title}
            </p>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                m.featured ? 'bg-white/15 text-white' : 'bg-gray-100 text-cs-ink'
              }`}
            >
              <ArrowUpRight size={16} strokeWidth={2} />
            </span>
          </div>
          <p className="mb-2 text-[40px] font-bold leading-none tracking-tight">{m.value}</p>
          <p className={`text-[12px] ${m.featured ? 'text-white/75' : 'text-cs-muted'}`}>
            {m.note && (
              <span className={m.featured ? 'text-cs-mint' : 'text-cs-forest font-medium'}>
                {m.note}{' '}
              </span>
            )}
            {m.suffix}
          </p>
        </article>
      ))}
    </div>
  )
}
