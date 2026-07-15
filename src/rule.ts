export interface Rule {
  heading: string;
  weight: number;
  body: string;
}

export function parse(content: string): Rule[] {
  const lines = content.split("\n");
  const rules: Rule[] = [];
  const stack: {
    heading: string;
    weight: number;
    body: string[];
    level: number;
  }[] = [];

  function popUntil(level: number) {
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      const s = stack.pop()!;
      const body = s.body.join("\n").trim();
      if (body.length > 0 && s.weight > 0) {
        rules.push({ heading: s.heading, weight: s.weight, body });
      }
    }
  }

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      let heading = m[2].trim();
      let weight = 0;
      const w = heading.match(/\s*@(\d+)\s*$/);
      if (w) {
        weight = Math.max(1, parseInt(w[1], 10));
        heading = heading.slice(0, heading.length - w[0].length).trim();
      }

      popUntil(level);

      const section = { heading, weight, body: [] as string[], level };
      const cleanHeading = "#".repeat(level) + " " + heading;
      for (const s of stack) {
        s.body.push(cleanHeading);
      }
      stack.push(section);
    } else {
      for (const s of stack) {
        s.body.push(line);
      }
    }
  }
  popUntil(0);

  return rules;
}
