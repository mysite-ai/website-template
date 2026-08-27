import assert from "node:assert/strict";
import {
  OT_SOURCE,
  OT_CAMPAIGN_FALLBACK,
  resolveOtCampaign,
  isOpenTableUrl,
  tagOpenTableUrl,
  hasOpenTableLink,
} from "../src/lib/opentable/tagging.ts";

let pass = 0;
const check = (label, fn) => {
  try {
    fn();
    pass++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    console.log(`  FAIL ${label}\n       ${err.message}`);
    process.exitCode = 1;
  }
};

console.log("\nresolveOtCampaign — pk extraction");
check("canonical production composite .pi1.pk85.ps1234 -> pk85", () =>
  assert.equal(resolveOtCampaign(".pi1.pk85.ps1234"), "pk85"),
);
check("spec example pi1.pk1_xyz -> pk1", () =>
  assert.equal(resolveOtCampaign("pi1.pk1_xyz"), "pk1"),
);
check("bare pk7 -> pk7", () => assert.equal(resolveOtCampaign("pk7"), "pk7"));
check("multi-digit .pi1.pk1234.ps9 -> pk1234", () =>
  assert.equal(resolveOtCampaign(".pi1.pk1234.ps9"), "pk1234"),
);
check("null -> mysite", () => assert.equal(resolveOtCampaign(null), OT_CAMPAIGN_FALLBACK));
check("empty string -> mysite", () => assert.equal(resolveOtCampaign(""), OT_CAMPAIGN_FALLBACK));
check("no pk segment -> mysite", () =>
  assert.equal(resolveOtCampaign(".pi1.ps1234"), OT_CAMPAIGN_FALLBACK),
);
check("does not match embedded 'spk5'", () =>
  assert.equal(resolveOtCampaign("spk5"), OT_CAMPAIGN_FALLBACK),
);
check("injection attempt is never echoed", () =>
  assert.equal(
    resolveOtCampaign("<script>alert(1)</script>&ot_source=evil"),
    OT_CAMPAIGN_FALLBACK,
  ),
);
check("pk with injection suffix yields only pk12", () =>
  assert.equal(resolveOtCampaign(".pi1.pk12.ps1&ot_source=evil"), "pk12"),
);

console.log("\nisOpenTableUrl — hostname allowlist");
for (const host of [
  "https://www.opentable.com/r/my-bistro",
  "https://opentable.com/booking/view?rid=1",
  "https://reserve.opentable.com/x",
  "https://www.opentable.co.uk/r/x",
  "https://opentable.com.au/r/x",
]) {
  check(`accepts ${host}`, () => assert.equal(isOpenTableUrl(new URL(host)), true));
}
for (const host of [
  "https://opentable.attacker.com/r/x",
  "https://notopentable.com/r/x",
  "https://wolt.com/x",
  "https://resy.com/cities/ny/my-bistro",
]) {
  check(`rejects ${host}`, () => assert.equal(isOpenTableUrl(new URL(host)), false));
}

console.log("\ntagOpenTableUrl — outbound link shape");
check("tags a plain OpenTable link", () => {
  const out = new URL(tagOpenTableUrl("https://www.opentable.com/r/my-bistro", "pk85"));
  assert.equal(out.searchParams.get("ot_source"), OT_SOURCE);
  assert.equal(out.searchParams.get("ot_campaign"), "pk85");
});
check("preserves pre-existing params (rid)", () => {
  const out = new URL(
    tagOpenTableUrl("https://www.opentable.com/booking/view?rid=12345&p=2", "pk85"),
  );
  assert.equal(out.searchParams.get("rid"), "12345");
  assert.equal(out.searchParams.get("p"), "2");
  assert.equal(out.searchParams.get("ot_campaign"), "pk85");
});
check("overwrites operator-pasted ot_source/ot_campaign", () => {
  const out = new URL(
    tagOpenTableUrl(
      "https://www.opentable.com/r/x?ot_source=Instagram&ot_campaign=their-own",
      "pk85",
    ),
  );
  assert.equal(out.searchParams.get("ot_source"), OT_SOURCE);
  assert.equal(out.searchParams.get("ot_campaign"), "pk85");
});
check("preserves fragment", () =>
  assert.match(tagOpenTableUrl("https://www.opentable.com/r/x#book", "pk1"), /#book$/),
);
check("leaves non-OpenTable link byte-identical", () =>
  assert.equal(tagOpenTableUrl("https://wolt.com/x", "pk85"), "https://wolt.com/x"),
);
check("leaves tel: link untouched", () =>
  assert.equal(tagOpenTableUrl("tel:+15555550100", "pk85"), "tel:+15555550100"),
);
check("unparseable href falls back to raw", () =>
  assert.equal(tagOpenTableUrl("not a url", "pk85"), "not a url"),
);

console.log("\nhasOpenTableLink — server-side gate");
const base = { action_tiles: null, delivery: [], website_url: null };
check("detects OpenTable in action_tiles", () =>
  assert.equal(
    hasOpenTableLink({
      ...base,
      action_tiles: [
        { type: "directions", href: "https://maps.google.com/?q=x" },
        { type: "book", href: "https://www.opentable.com/r/my-bistro" },
      ],
    }),
    true,
  ),
);
check("detects OpenTable in delivery[]", () =>
  assert.equal(
    hasOpenTableLink({ ...base, delivery: [{ name: "OpenTable", url: "https://opentable.com/r/x" }] }),
    true,
  ),
);
check("detects OpenTable in website_url", () =>
  assert.equal(hasOpenTableLink({ ...base, website_url: "https://opentable.co.uk/r/x" }), true),
);
check("false for tenant without OpenTable", () =>
  assert.equal(
    hasOpenTableLink({
      ...base,
      action_tiles: [{ type: "order", href: "https://wolt.com/x" }],
      delivery: [{ name: "Wolt", url: "https://wolt.com/x" }],
      website_url: "https://my-bistro.com",
    }),
    false,
  ),
);
check("false for null action_tiles + empty delivery", () =>
  assert.equal(hasOpenTableLink(base), false),
);
check("tolerates malformed href in tiles", () =>
  assert.equal(hasOpenTableLink({ ...base, action_tiles: [{ type: "book", href: "???" }] }), false),
);

console.log(`\n${pass} assertions passed${process.exitCode ? " (with failures above)" : ""}\n`);
