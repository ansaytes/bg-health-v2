const mammoth = require("mammoth");
const fs = require("fs");

mammoth.extractRawText({path: "SOP_PTM.docx"})
    .then(function(result) {
        var text = result.value; // The raw text
        var messages = result.messages;
        fs.writeFileSync("SOP_PTM_text.txt", text);
        console.log("Extracted text length:", text.length);
        if (messages.length > 0) {
            console.log("Messages:", messages);
        }
    })
    .catch(function(error) {
        console.error(error);
    });
