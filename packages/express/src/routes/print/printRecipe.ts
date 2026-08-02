import { prisma, recipeSummary } from "@recipesage/prisma";
import { z } from "zod";
import { NotFoundError } from "../../errors";
import { AuthenticationEnforcement, defineHandler } from "../../defineHandler";
import {
  parseIngredients,
  parseInstructions,
  parseNotes,
  inferRecipeNotation,
} from "@recipesage/util/shared";
import {
  getRequestLanguage,
  sanitizeRemoveHtmlFromString,
  sortRecipeImages,
} from "@recipesage/util/server/general";

const schema = {
  query: z.object({
    version: z.string(),
    halfsheet: z.string().optional(),
    twocolIngr: z.string().optional(),
    verticalInstrIng: z.string().optional(),
    titleImage: z.string().optional(),
    hideNotes: z.string().optional(),
    hideSource: z.string().optional(),
    hideSourceURL: z.string().optional(),
    printPreview: z.string().optional(),
    showPrintButton: z.string().optional(),
    print: z.string().optional(),
    scale: z.string().optional(),
    token: z.string().optional(),
  }),
  params: z.object({
    recipeId: z.string(),
  }),
};

export const printRecipeHandler = defineHandler(
  {
    schema,
    authentication: AuthenticationEnforcement.Optional,
  },
  async (req, res) => {
    const recipe = await prisma.recipe.findUnique({
      where: {
        id: req.params.recipeId,
      },
      ...recipeSummary,
    });

    if (!recipe) {
      throw new NotFoundError("Recipe not found");
    }

    const sorted = sortRecipeImages(recipe);

    const isOwner = res.locals.session
      ? res.locals.session.userId === recipe.userId
      : false;

    const scale =
      typeof req.query.scale === "string" && req.query.scale.trim()
        ? req.query.scale
        : "1";

    const locale = getRequestLanguage(req);

    const ingredientsText = sanitizeRemoveHtmlFromString(sorted.ingredients);
    const instructionsText = sanitizeRemoveHtmlFromString(sorted.instructions);
    const notesText = sanitizeRemoveHtmlFromString(sorted.notes);
    const decimalNotationMode = inferRecipeNotation(
      {
        ingredients: ingredientsText,
        instructions: instructionsText,
        notes: notesText,
      },
      locale,
    );

    const modifiers = {
      version: req.query.version,
      halfsheet: !!req.query.halfsheet,
      twocolIngr: !!req.query.twocolIngr,
      verticalInstrIng: !!req.query.verticalInstrIng,
      titleImage: !!req.query.titleImage,
      hideNotes: !!req.query.hideNotes,
      hideSource: !!req.query.hideSource,
      hideSourceURL: !!req.query.hideSourceURL,
      printPreview: !!req.query.printPreview,
      showPrintButton: !!req.query.showPrintButton,
      scale,
    };

    const images = modifiers.titleImage
      ? sorted.recipeImages.map((ri) => ri.image)
      : [];

    const inlineImageRefs = sorted.recipeImages.map((ri) => ({
      url: ri.image.location,
    }));

    const labels = isOwner ? sorted.recipeLabels.map((rl) => rl.label) : [];

    res.render("recipe-default", {
      recipe: {
        id: sorted.id,
        title: sorted.title,
        description: sorted.description,
        yield: sorted.yield,
        activeTime: sorted.activeTime,
        totalTime: sorted.totalTime,
        source: sorted.source,
        url: sorted.url,
        images,
        labels,
        ingredients: parseIngredients(ingredientsText, scale, {
          decimalNotationMode,
        }),
        instructions: parseInstructions(instructionsText, scale, {
          decimalNotationMode,
          images: inlineImageRefs,
        }),
        notes: parseNotes(notesText, scale, {
          decimalNotationMode,
          images: inlineImageRefs,
        }),
      },
      recipeURL: `https://recipesage.com/app/recipe/${sorted.id}`,
      date: new Date().toDateString(),
      modifiers,
    });
  },
);
