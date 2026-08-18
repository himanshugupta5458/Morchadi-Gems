"use client";

import { useState } from "react";
import { validateMessage } from "@/lib/contact";
import { TextAreaField } from "@/components/TextAreaField";

/** `/style-guide` is a Server Component, so this controlled field needs a client host. */
export function TextAreaFieldPreview(): JSX.Element {
  const [message, setMessage] = useState("Too short");
  const [isTouched, setIsTouched] = useState(true);

  return (
    <div className="max-w-prose">
      <TextAreaField
        id="preview-message"
        label="Message"
        value={message}
        rows={4}
        error={isTouched ? validateMessage(message) : undefined}
        onChange={setMessage}
        onBlur={() => setIsTouched(true)}
      />
    </div>
  );
}
