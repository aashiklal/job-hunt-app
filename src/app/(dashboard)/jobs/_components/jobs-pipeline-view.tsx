"use client";

import { useOptimistic, useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobListItem, JobStatus } from "@/lib/repositories/jobs";
import { setJobStatus } from "@/app/(dashboard)/jobs/_actions";

const COLUMNS: ReadonlyArray<{ status: JobStatus; label: string }> = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "screening", label: "Screening" },
  { status: "interview", label: "Interview" },
  { status: "assessment", label: "Assessment" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "withdrawn", label: "Withdrawn" },
];

const VALID_STATUSES = COLUMNS.map((c) => c.status);

type OptimisticAction = { type: "move"; jobId: string; toStatus: JobStatus };

function optimisticReducer(
  jobs: JobListItem[],
  action: OptimisticAction
): JobListItem[] {
  if (action.type === "move") {
    return jobs.map((j) =>
      j._id === action.jobId
        ? { ...j, status: action.toStatus, updatedAt: new Date().toISOString() }
        : j
    );
  }
  return jobs;
}

function DraggableCard({ job }: { job: JobListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job._id,
      data: { fromStatus: job.status },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-50" : ""}
    >
      <Link href={`/jobs/${job._id}`}>
        <Card className="hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors">
          <CardContent className="p-3 space-y-1">
            <p className="font-semibold text-sm leading-tight">{job.company}</p>
            <p className="text-sm text-muted-foreground leading-tight">
              {job.role}
            </p>
            {job.location && (
              <p className="text-xs text-muted-foreground">{job.location}</p>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              {formatDistanceToNow(new Date(job.updatedAt), {
                addSuffix: true,
              })}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

function DroppableColumn({
  status,
  label,
  jobs,
}: {
  status: JobStatus;
  label: string;
  jobs: JobListItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <Badge variant="secondary" className="text-xs">
          {jobs.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-24 rounded-lg p-2 transition-colors ${
          isOver ? "bg-muted" : "bg-muted/30"
        }`}
      >
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center min-h-16">
            <p className="text-xs text-muted-foreground">No jobs</p>
          </div>
        ) : (
          jobs.map((job) => <DraggableCard key={job._id} job={job} />)
        )}
      </div>
    </div>
  );
}

function MobileCard({
  job,
  onMove,
}: {
  job: JobListItem;
  onMove: (toStatus: JobStatus) => void;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <Link href={`/jobs/${job._id}`} className="block space-y-1">
          <p className="font-semibold text-sm leading-tight">{job.company}</p>
          <p className="text-sm text-muted-foreground leading-tight">
            {job.role}
          </p>
          {job.location && (
            <p className="text-xs text-muted-foreground">{job.location}</p>
          )}
          <p className="text-xs text-muted-foreground pt-0.5">
            {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
          </p>
        </Link>
        <Select
          value={job.status}
          onValueChange={(v) => onMove(v as JobStatus)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

type Props = {
  jobs: JobListItem[];
};

export function JobsPipelineView({ jobs }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeCard, setActiveCard] = useState<JobListItem | null>(null);
  const [mobileStatus, setMobileStatus] = useState<JobStatus>("applied");

  const [optimisticJobs, applyOptimistic] = useOptimistic(
    jobs,
    optimisticReducer
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = new Map<JobStatus, JobListItem[]>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const job of optimisticJobs) {
    const list = grouped.get(job.status);
    if (list) list.push(job);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function handleMove(jobId: string, toStatus: JobStatus) {
    const job = optimisticJobs.find((j) => j._id === jobId);
    if (!job || job.status === toStatus) return;

    startTransition(async () => {
      applyOptimistic({ type: "move", jobId, toStatus });
      const result = await setJobStatus({ jobId, status: toStatus });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const job = optimisticJobs.find((j) => j._id === event.active.id);
    setActiveCard(job ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const jobId = String(active.id);
    const overId = String(over.id);

    if (!overId.startsWith("column-")) return;
    const toStatusRaw = overId.slice("column-".length);

    if (!VALID_STATUSES.includes(toStatusRaw as JobStatus)) return;
    handleMove(jobId, toStatusRaw as JobStatus);
  }

  const mobileJobs = grouped.get(mobileStatus) ?? [];

  return (
    <>
      <div className="md:hidden space-y-3">
        <Select
          value={mobileStatus}
          onValueChange={(v) => setMobileStatus(v as JobStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((col) => {
              const count = grouped.get(col.status)?.length ?? 0;
              return (
                <SelectItem key={col.status} value={col.status}>
                  {col.label} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {mobileJobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No jobs here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mobileJobs.map((job) => (
              <MobileCard
                key={job._id}
                job={job}
                onMove={(toStatus) => handleMove(job._id, toStatus)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map((col) => (
                <DroppableColumn
                  key={col.status}
                  status={col.status}
                  label={col.label}
                  jobs={grouped.get(col.status) ?? []}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <Card className="cursor-grabbing shadow-lg w-72">
                <CardContent className="p-3 space-y-1">
                  <p className="font-semibold text-sm leading-tight">
                    {activeCard.company}
                  </p>
                  <p className="text-sm text-muted-foreground leading-tight">
                    {activeCard.role}
                  </p>
                  {activeCard.location && (
                    <p className="text-xs text-muted-foreground">
                      {activeCard.location}
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}
