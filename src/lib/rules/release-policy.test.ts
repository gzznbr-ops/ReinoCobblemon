import test from "node:test";
import assert from "node:assert/strict";
import { compareVersions, deploymentMatches, eligibleRelease, stableVersion } from "./release-policy";

test("only paired stable releases newer than the installed version can be approved", () => {
  assert.equal(eligibleRelease("0.10.11", "0.10.12", "0.10.12"), "0.10.12");
  assert.equal(eligibleRelease("0.10.11", "0.10.12", "0.10.11"), null);
  assert.equal(eligibleRelease("0.10.11", "0.10.11", "0.10.11"), null);
  assert.equal(eligibleRelease("0.10.11", "0.9.99", "0.9.99"), null);
  assert.equal(eligibleRelease("0.10.11", "1.0.0-rc.1", "1.0.0-rc.1"), null);
  assert.ok(compareVersions("0.10.11", "0.9.99") > 0);
  for (const version of ["latest", "1.0.0; echo bad", "01.2.3", "https://evil.test/pkg", "1.0.0\n"]) {
    assert.equal(stableVersion(version), false, version);
  }
});

test("a successful hook or matching version alone cannot unlock publication", () => {
  const state = { version: "0.10.12", revision: "approval-2", buildId: "build-2" };
  assert.equal(deploymentMatches(state, { version: "0.10.12" }), false);
  assert.equal(deploymentMatches(state, { version: "0.10.12", rulesRevision: "approval-2", deploymentId: "build-1" }), false);
  assert.equal(deploymentMatches(state, { version: "0.10.12", rulesRevision: "approval-1", deploymentId: "build-2" }), false);
  assert.equal(deploymentMatches(state, { version: "0.10.11", rulesRevision: "approval-2", deploymentId: "build-2" }), false);
  assert.equal(deploymentMatches(state, { version: "0.10.12", rulesRevision: "approval-2", deploymentId: "build-2" }), true);
});
