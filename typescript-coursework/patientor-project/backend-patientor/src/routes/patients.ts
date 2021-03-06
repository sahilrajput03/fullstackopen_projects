/* eslint-disable @typescript-eslint/no-unused-vars */
import express, { Request, Response } from 'express';
// import diaryService from '../services/diaryService';
import diagnosesService from '../services/diagnoseService';
import { NewPatient, OccupationalHealthcareEntry, HospitalEntry, HealthCheckEntry, Entry } from '../types';
import { assert } from 'console';
const router = express.Router();

const isString = (text: unknown): text is string => {
  return typeof text === 'string' || text instanceof String;
};
const assertNever = (value: never): never => {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
};

//// interface InterfaceResponse {
////   // eslint-disable-next-line @typescript-eslint/no-explicit-any
////   send: (param: Entry | string) => Response<any>,
////   //                              This send  ^^^  return  includes all favorable properties which are to be send via express(from http.server)
////   status: (statusCode: number) => {
////     // eslint-disable-next-line @typescript-eslint/no-explicit-any
////     send: (errorCode: string) => Response<any>
////   }
//// }

router.post('/:id/entries', (req: Request, res: Response) => {
  //// /* old coders style =>  */ router.post('/:id/entries', (req, res: InterfaceResponse) => {
  console.log('Hello');
  const body = req.body as Entry;
  console.log(`${JSON.stringify(body, null, 2)}`);


  try {
    throw new Error("Cool, Stopping point.");
  } catch (error) {
    if (error instanceof Error) console.log(`${error.message}`);
    // Above statement only evaluates as true if error is an instance of Error (see in try block).
  }








  const currentPatient = diagnosesService.getPatientEntries().find(p => p.id === req.params.id);
  if (!currentPatient) return res.status(500).send("Invalid patient id in the url params. :( No match with given id found actually.)");
  if (!(isString(body.type) && isString(body.date) && isString(body.specialist)))
    return res.status(500).send("Invalid(string required) or missing parameters(type/date/specialist).");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  let entryToBeSaved: Entry = { date: body.date, specialist: body.specialist, type: body.type } as Entry;
  if (body.description) entryToBeSaved.description = body.description;
  switch (body.type) {
    case "OccupationalHealthcare":
      entryToBeSaved = { ...entryToBeSaved } as OccupationalHealthcareEntry;
      if (body.employerName) entryToBeSaved.employerName = body.employerName;
      if (body.sickLeave) entryToBeSaved.sickLeave = body.sickLeave;
      if (body.diagnosisCodes) entryToBeSaved.diagnosisCodes = body.diagnosisCodes;
      return res.send(diagnosesService.addEntryInAPatient(req.params.id, entryToBeSaved));

    case "Hospital":
      entryToBeSaved = { ...entryToBeSaved } as HospitalEntry;
      if (!body.diagnosisCodes || isString(body.diagnosisCodes))
        return res.status(500).send("diagnosisCodes field invalid(string required)/missing from the entry data");
      entryToBeSaved.diagnosisCodes = body.diagnosisCodes;
      if (body.discharge) entryToBeSaved.discharge = body.discharge;
      return res.send(diagnosesService.addEntryInAPatient(req.params.id, entryToBeSaved));

    case "HealthCheck":
      entryToBeSaved = { ...entryToBeSaved } as HealthCheckEntry;
      if ((!body.healthCheckRating && body.healthCheckRating !== 0) || body.healthCheckRating > 3 || body.healthCheckRating < 0)
        return res.status(500).send("healthCheckRating field invalid(number required)/missing/out of range value in the entry data.");
      entryToBeSaved.healthCheckRating = body.healthCheckRating;
      return res.send(diagnosesService.addEntryInAPatient(req.params.id, entryToBeSaved));

    default:
      return assertNever(body);
  }
});

router.get('/', (_req, res) => {
  // res.send('Fetching all diaries!');
  res.header("Content-Type", 'application/json');
  res.send(JSON.stringify(diagnosesService.getPatientEntries(), null, 4));
  // res.send(JSON.stringify(diaryService.getNonSensitiveEntries(), null, 4));
});

router.get('/:id', (req, res) => {
  const singleEntry = diagnosesService.getPatientEntries().find(e => e.id == req.params.id);
  res.header("Content-Type", 'application/json');
  res.send(JSON.stringify(singleEntry, null, 4));
});


router.post('/', (req, res) => {
  // const body: NewPatient= req.body as NewPatient; // This works great too.
  const { name, ssn, occupation, gender, dateOfBirth } = req.body as NewPatient;
  if (isString(name) && isString(ssn) && isString(occupation) && isString(gender) && isString(dateOfBirth)) {
    const newPatientWithId = diagnosesService.addNewPatient(req.body);
    res.send(newPatientWithId);
  } else {
    res.status(500).send('Bad Entry!!');
    //Dealing in frontend
    //  In frontend you may deal this text via like this:-
    // try {
    //   Some axios request to this route.
    // } catch (err) {
    //   console.log('error.name==>>>', err.name) // Output: Error
    //   console.log('error.message==>>>', err.message) // Output: Request failed with status code 500
    //   console.log('error.response.data==>>>', err.response.data) // Output: my_message
    // **err.response.data** is anything that we send by =>  res.status(500).end("my_message") or res.status(500).send("my_message")
    // }
  }
});

export default router;