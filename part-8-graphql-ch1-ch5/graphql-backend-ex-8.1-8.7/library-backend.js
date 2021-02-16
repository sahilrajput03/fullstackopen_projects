// require("graphql-config");
const {importSchema} = require("graphql-import");
const graphqlFields = require("graphql-fields");
const magicalParser = require("./magicalParser");
const jwt = require("jsonwebtoken");
const {v1: uuid} = require("uuid");
const {ApolloServer, gql, UserInputError} = require("apollo-server");

const mongoose = require("mongoose");
const {PubSub} = require("apollo-server");
const pubsub = new PubSub();

const JWT_SECRET = "golmaal";

// const { books, authors } = require("./data");

//models of collections in mongodb
const BookSchema = require("./models/bookSchema");
const AuthorSchema = require("./models/authorSchema");
const User = require("./models/user");

mongoose.set("useFindAndModify", false);

const MONGODB_URI = "mongodb://localhost/admin"; //mu localcally running db
mongoose.set("useCreateIndex", true);
console.log("connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true})
  .then(() => {
    console.log("connected to MongoDB");
  })
  .catch((error) => {
    console.log("error connection to MongoDB:", error.message);
  });

// Code for once to load, or delete all document in db.
// Book.collection.deleteMany({});
// Author.collection.deleteMany({});
// Book.collection.insertMany(books);
// Author.collection.insertMany(authors);

const typeDefs = importSchema("typedefs.graphql");

const resolvers = {
  Query: {
    bookCount: () => books.length,
    authorCount: () => authors.length,
    allBooks: async (root, args, _, info) => {
      // Below method is absolutely fine to fetch top level fields. - 1.
      const fields = graphqlFields(info);
      console.log("Fields(allBooks)-->", fields);
      // Some help in parsing query fields:-
      // Line:22-a Print top level fields wit Object.keys method.
      // Line:22 Redundant--> This line isn't needed actually as by default it fetches the subfields too.
      // Line: 22-c My personal parser, but its just redundant.
      // console.log("Object.keys(topLevelFields)(allBooks)-->", Object.keys(topLevelFields)); //Line 22-a
      // const fieldsWithSubFieldsArgs = graphqlFields(info, {}, { processArguments: true }); //Line 22.
      // magicalParser("Query fields", info); // Method 2 (Self made parser).

      const books = await BookSchema.find({}).populate("author");
      // console.log("bookksss-", books);
      if (args.author) {
        return books.filter((b) => b.author == args.author);
      } else if (args.genre) {
        return books.filter((b) => b.genres.includes(args.genre));
      } else {
        return books;
      }
    },
    allAuthors: async (root, args, context, info) => {
      // console.log("info--> ", JSON.parse(JSON.stringify(info)));
      const topLevelFields = graphqlFields(info);
      console.log("my top level requested fields(allAuthors)-->", Object.keys(topLevelFields));

      const authors = await AuthorSchema.find({});
      if (!args.bookCount) {
        return authors.map((auth) => ({
          name: auth.name,
          // bookCount: books.filter((b) => b.author.name == auth.name).length, /* TRYING TO HELP n+1 PROBLEM.*/
          bookCount: null,
          born: auth.born,
        }));
      } else {
        const books = await BookSchema.find({}).populate("author");
        return authors.map((auth) => ({
          name: auth.name,
          bookCount: books.filter((b) => b.author.name == auth.name).length,
          born: auth.born,
        }));
      }
    },
    me: (root, args, context) => {
      console.log("context.currentUser-->", context.currentUser);
      return context.currentUser;
    },
  },
  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser;
      console.log("currentuser-->", currentUser);
      //Output:- currentuser--> { _id: 5edc9f9a1c00f9166cae0847, username: 'sahilrajput03', __v: 0 }
      if (!currentUser) {
        throw new AuthenticationError("not authenticated");
      }

      console.log("=1==addBook Mutation===");
      if (args.title.length < 5) {
        throw new UserInputError("short length of title!!");
        // Code after above line is unreachable and the program is jumped out of this mutation.Hell yeah!!
      }
      // console.log("$args:-", args);
      const books = await BookSchema.find({});
      // const books = await BookSchema.find({}).populate("author");
      if (books.find((p) => p.title === args.title)) {
        throw new UserInputError("Title must be unique", {
          invalidArgs: args.title,
        });
      }
      // const book = { ...args, id: uuid() }; // Old coder's style.
      const checkAuthor = await AuthorSchema.findOne({name: args.author});
      let book;
      let newAuthor;
      if (checkAuthor) {
        book = {...args, author: checkAuthor.id}; // This is usable acc. to situation.
      } else {
        try {
          newAuthor = await new AuthorSchema({name: args.author, born: Number(0)}).save();
          console.log("=2==new author is created===");
          book = {...args, author: newAuthor.id}; // This is usable acc. to situation.
        } catch (error) {
          console.log(`♣==error occured while saving1== ${error.message} ==from== ${error.name}.`);
        }
      }

      const authorGod = checkAuthor ? checkAuthor : newAuthor;

      try {
        // delete args.author; //This line is redundant.
        const bookSaved = await new BookSchema({...book}).save();
        bookSaved.author.name = authorGod.name;
        bookSaved.author.born = authorGod.born;
        console.log("☻==user saved succcesfully==");

        pubsub.publish("BOOK_ADDED", {bookAdded: bookSaved}); //Send subscription alerts.

        return bookSaved;
      } catch (error) {
        console.log(`♣==error occured while saving2== ${error.message} ==from== ${error.name}.`);
        return error.message;
      }
      //#region
      // console.log("$person:-", person);
      // if (true) {
      //   // console.log(
      //   //   "$authors.find(args.author)",
      //   //   authors.find((item) => item == args.author)
      //   // );
      //   authors.push({ name: args.author, id: uuid() });
      // }
      // // books = books.concat(book);
      //#endregion
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new AuthenticationError("not authenticated");
      }
      // const toEdit = authors.find({}).find((a) => a.name == args.name); // Old coder's style.
      // const toEdit = await AuthorSchema.findOneAndUpdate({ name: args.name });
      const toEdit = await AuthorSchema.findOne({name: args.name});
      console.log("$toEdit:-", toEdit);
      if (!toEdit) {
        return null;
      }
      toEdit.born = args.setBornTo; // Assigned to old object directly.
      // const edited = { ...toEdit, born: args.setBornTo }; // Old coder's style.
      // authors = authors.map((a) => (a.name === args.name ? edited : a)); // Old coder's style.

      try {
        await toEdit.save();
      } catch (error) {
        //when we throw this error, it's caught by graphql and is sent to frontend automatically.:D
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }
      return toEdit;
    },
    createUser: (root, args) => {
      const user = new User({username: args.username});

      return user.save().catch((error) => {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({username: args.username});
      console.log("userfound=>", user);
      console.log("going onn..1");
      if (!user || args.password !== "pass") {
        //Password must be "secred" otherwise user will be sent, "wrong credentials" message.
        throw new UserInputError("wrong credentials");
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return {value: jwt.sign(userForToken, JWT_SECRET)};
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(["BOOK_ADDED"]),
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({req}) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      console.log("bearerrr-->>", auth);
      const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
      // const currentUser = await User.findById(decodedToken.id).populate("friends");
      const currentUser = await User.findById(decodedToken.id);
      return {currentUser};
    }
  },
});

server.listen({port: 4001}).then(({url, subscriptionsUrl}) => {
  console.log(`Server ready at ${url}`);
  console.log(`Subscriptions ready at ${subscriptionsUrl}`);
});
