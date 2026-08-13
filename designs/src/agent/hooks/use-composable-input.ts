import { useRef, type CompositionEvent, type KeyboardEvent } from "react";

/**
 * 한글(IME) 조합을 고려한 Enter 전송 처리.
 *
 * 조합 중(`isComposing`) Enter 는 "글자 확정"이지 전송이 아니다. 그대로 보내면
 * 마지막 음절이 잘리거나 Enter 가 통째로 씹힌다. 그래서 조합 중 Enter 는
 * 보류해 뒀다가(pendingEnter) 조합이 끝나는 순간 확정된 값으로 전송한다.
 *
 * 원본은 이 로직을 세 화면에 복붙해 두고 있었다 — 훅으로 한 벌만 둔다.
 */
export function useComposableInput(onSubmit: (text: string) => void) {
  const isComposingRef = useRef(false);
  const pendingEnterRef = useRef(false);

  /** 보류된 Enter 가 있으면 확정 값으로 전송. onChange/compositionEnd 양쪽에서 호출. */
  const flushPendingEnter = (value: string) => {
    if (!pendingEnterRef.current || isComposingRef.current) return;
    pendingEnterRef.current = false;
    const text = value.trim();
    if (text) onSubmit(text);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    flushPendingEnter(e.currentTarget.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    // 조합 중이면 확정될 때까지 미룬다.
    if (isComposingRef.current) {
      pendingEnterRef.current = true;
      return;
    }
    const text = e.currentTarget.value.trim();
    if (text) onSubmit(text);
  };

  return {
    isComposingRef,
    flushPendingEnter,
    handleCompositionStart,
    handleCompositionEnd,
    handleKeyDown,
  };
}
