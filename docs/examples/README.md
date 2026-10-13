# Local Document Retrieval Example

The [Northstar Observatory sample](sample-document.md) and all example questions
and answers below are synthetic and public-safe. They describe a fictional
educational project and contain no real facility or private operational data.

## Try the sample

1. With HALO Console running locally, open the Documents panel.
2. Click `Upload`, then choose `docs/examples/sample-document.md` from this
   repository using the file picker. Wait for the document to appear in the list.
3. Enable `Use Local Docs` in the chat composer. If `Use Selected Docs` is enabled,
   select the uploaded sample so it is included in retrieval.
4. Ask one of the questions below. Compare the response with the expected facts
   and inspect the retrieved sources and chunks when available.

## Example questions and expected answers

These six examples use only facts from `sample-document.md`. Answer wording may
vary; the final example should acknowledge the source's limits.

1. **What is the purpose of Northstar Observatory?**

   Expected answer: It is a fictional educational project studying patterns in
   simulated night-sky observations. It helps learners compare measurements,
   identify missing records, and explain how routine maintenance affects data
   quality. It produces a weekly observation summary.

2. **When does Northstar Observatory run observations and prepare its weekly summary?**

   Expected answer: Simulated observations run Tuesday through Saturday, from
   20:00 to 23:00 on the fictional project clock. Monday is reserved for calibration
   and maintenance; Sunday is a rest day with no scheduled observations. The
   weekly summary is prepared every Monday at 14:00.

3. **What reference value and tolerance does the calibration module use, and when do observations pause?**

   Expected answer: The reference value is 100 units. A deviation greater than
   five units triggers a calibration review, without automatically discarding
   earlier observations. If two consecutive calibration checks exceed the
   five-unit tolerance, observations pause until a review records a successful
   check.

4. **What routine maintenance checks are required for Northstar Observatory?**

   Expected answer: Check the calibration reference every Monday before the next
   operating cycle. Perform a simulated observation-module alignment check after
   every ten sessions. Review archive collections weekly for duplicate sequence
   labels and missing quality flags. Maintenance entries record the affected
   component, issue, corrective action, and resulting status.

5. **What safety rules apply to the Northstar Observatory demonstration?**

   Expected answer: Use only synthetic observations; do not add personal
   information, credentials, real equipment details, or private operational
   records. Keep rejected readings visible in summary counts, do not present
   uncertain readings as confirmed results, and resume a paused session only
   after its calibration review is complete. The procedures are fictional
   training material, not instructions for real observatory equipment.

6. **What is Northstar Observatory's annual operating budget?**

   Expected answer: The source does not provide an annual operating budget. The
   response should acknowledge that the information is unavailable rather than
   inventing an amount.
