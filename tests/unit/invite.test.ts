import { expect, it } from "vitest";
import { inviteUrl, readInvite } from "../../apps/client/src/invite";

it("builds and reads invite links", () => {
  const url = inviteUrl("https://parena.litojace.com/", "AB12CD");
  expect(url).toBe("https://parena.litojace.com/?room=AB12CD");
  expect(readInvite(new URL(url).search)).toBe("AB12CD");
  expect(readInvite("?room=ab12cd")).toBe("AB12CD"); // typed in lowercase
  expect(readInvite("?room=%3Cscript%3E")).toBeUndefined(); // junk ignored
  expect(readInvite("?other=1")).toBeUndefined();
});
