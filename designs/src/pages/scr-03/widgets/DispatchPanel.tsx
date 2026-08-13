/* ─────────────────────────────────────────────
 * 상황전파 — 03 화면정의서 §3 우측
 *
 * 판단한 그 자리에서 주민과 관계기관에 안내를 내보낸다. 문안은 이벤트에서 자동 작성된
 * 상태로 뜨고 고쳐 보낼 수 있다. 데모에서는 실제 발송 없이 내역만 쌓는다.
 * ───────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, FilterCapsule, Textarea, toast } from "@ds";
import { CHANNELS, DEFAULT_CHANNELS, draftMessage, type ChannelId } from "../../../demo/dispatch";
import type { AlertEvent } from "../../../demo/events";
import { findDistrict } from "../../../demo/districts";
import { levelSpec } from "../../../demo/levels";

interface DispatchPanelProps {
  event: AlertEvent;
  onDispatch: (channels: ChannelId[], message: string) => void;
}

export function DispatchPanel({ event, onDispatch }: DispatchPanelProps) {
  const [channels, setChannels] = useState<ChannelId[]>(DEFAULT_CHANNELS);
  const [message, setMessage] = useState(() => draftMessage(event));

  /* 이벤트를 바꾸면 문안도 그 이벤트 것으로 다시 쓴다. 앞 이벤트 문안이 남아 있으면
     엉뚱한 마을에 보내는 사고가 난다 */
  useEffect(() => {
    setMessage(draftMessage(event));
    setChannels(DEFAULT_CHANNELS);
  }, [event]);

  const district = findDistrict(event.districtId);
  const spec = levelSpec(event.level);

  const handleDispatch = () => {
    if (channels.length === 0) {
      toast.error("전파 수단을 하나 이상 고르세요.");
      return;
    }
    onDispatch(channels, message);
    const names = CHANNELS.filter((c) => channels.includes(c.id))
      .map((c) => c.label)
      .join(", ");
    toast.success(`${district?.name} ${spec.label} 안내를 ${names}로 전파했습니다.`);
  };

  return (
    <section className="flex flex-col gap-2 p-3" aria-label="상황전파">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-foreground">상황전파</h2>
        <span className="truncate text-caption text-foreground-subtle">
          {district?.name} {spec.label}
        </span>
      </header>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        aria-label="전파 문안"
        className="text-caption"
      />

      {/* 전파 수단 — DS FilterCapsule 복수 선택. 켜진 수단이 파랗게 차서, 보내기 전에
          어디로 나가는지가 버튼 위에서 읽힌다 */}
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((channel) => {
          const on = channels.includes(channel.id);
          return (
            <FilterCapsule
              key={channel.id}
              selected={on}
              aria-pressed={on}
              onClick={() =>
                setChannels((prev) =>
                  prev.includes(channel.id)
                    ? prev.filter((c) => c !== channel.id)
                    : [...prev, channel.id],
                )
              }
            >
              <Icon icon={channel.icon} className="size-3.5 shrink-0" aria-hidden />
              {channel.label}
            </FilterCapsule>
          );
        })}
      </div>

      <Button onClick={handleDispatch} className="w-full">
        <Icon icon="mdi:send" className="size-4" aria-hidden />
        전파
      </Button>
    </section>
  );
}
