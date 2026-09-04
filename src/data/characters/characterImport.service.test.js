import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import { importCharacterFromDdbPdf } from "./characterImport.service";
import { parsePdf } from "./pdfParser";

vi.mock("./pdfParser", () => ({
    parsePdf: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

test("rejects non-PDF input before invoking the parser", async () => {
    const result = await importCharacterFromDdbPdf({
        name: "character.txt",
        type: "text/plain",
    });

    assert.deepEqual(result, {
        ok: false,
        draft: null,
        error: "Selected file is not a PDF.",
    });
    assert.equal(parsePdf.mock.calls.length, 0);
});

test("maps the core character fields from a parsed PDF", async () => {
    parsePdf.mockResolvedValue({
        rawText: "",
        fields: {
            CharacterName: "Ari",
            RACE: "Elf",
            "CLASS LEVEL": "Wizard 3",
            BACKGROUND: "Sage",
        },
    });

    const result = await importCharacterFromDdbPdf({
        name: "ari.pdf",
        type: "application/pdf",
    });

    assert.equal(result.ok, true);
    assert.equal(result.draft.character.name, "Ari");
    assert.equal(result.draft.character.race, "Elf");
    assert.equal(result.draft.character.class, "Wizard 3");
    assert.equal(result.draft.character.level, 3);
    assert.equal(result.draft.character.importMeta.filename, "ari.pdf");
    assert.equal(parsePdf.mock.calls.length, 1);
});
