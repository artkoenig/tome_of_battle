// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
//
// Generated from the vendored BattleScribe schema at
// src/parser/schema/Catalogue.xsd by `npm run generate:schema`.
//
// This module is the single source of truth for the BattleScribe data format's
// closed enum sets and canonical attribute names (see ADR 0016). Parser and
// evaluator consume these constants instead of hand-typed string literals, which
// structurally eliminates the drift class behind the format bugs.
//
// A guard check (scripts/generate-schema-module.test.js) regenerates this file
// from the vendored XSD and fails if the committed content has drifted.

export const SelectionEntryKind = Object.freeze({
  UPGRADE: 'upgrade',
  MODEL: 'model',
  UNIT: 'unit',
});

export const InfoLinkKind = Object.freeze({
  INFO_GROUP: 'infoGroup',
  PROFILE: 'profile',
  RULE: 'rule',
});

export const CatalogueLinkKind = Object.freeze({
  CATALOGUE: 'catalogue',
});

export const EntryLinkKind = Object.freeze({
  SELECTION_ENTRY: 'selectionEntry',
  SELECTION_ENTRY_GROUP: 'selectionEntryGroup',
});

export const ConstraintKind = Object.freeze({
  MIN: 'min',
  MAX: 'max',
});

export const ModifierKind = Object.freeze({
  SET: 'set',
  INCREMENT: 'increment',
  DECREMENT: 'decrement',
  APPEND: 'append',
  ADD: 'add',
  REMOVE: 'remove',
  SET_PRIMARY: 'set-primary',
  UNSET_PRIMARY: 'unset-primary',
  MULTIPLY: 'multiply',
  PREPEND: 'prepend',
});

export const ConditionKind = Object.freeze({
  LESS_THAN: 'lessThan',
  GREATER_THAN: 'greaterThan',
  EQUAL_TO: 'equalTo',
  NOT_EQUAL_TO: 'notEqualTo',
  AT_LEAST: 'atLeast',
  AT_MOST: 'atMost',
  INSTANCE_OF: 'instanceOf',
  NOT_INSTANCE_OF: 'notInstanceOf',
});

export const ConditionGroupKind = Object.freeze({
  AND: 'and',
  OR: 'or',
});

export const AttributeName = Object.freeze({
  AUTHOR_CONTACT: 'authorContact',
  AUTHOR_NAME: 'authorName',
  AUTHOR_URL: 'authorUrl',
  BATTLE_SCRIBE_VERSION: 'battleScribeVersion',
  CATALOGUE_ID: 'catalogueId',
  CATALOGUE_NAME: 'catalogueName',
  CATALOGUE_REVISION: 'catalogueRevision',
  CHILD_ID: 'childId',
  COLLECTIVE: 'collective',
  CUSTOM_NAME: 'customName',
  DEFAULT_COST_LIMIT: 'defaultCostLimit',
  DEFAULT_SELECTION_ENTRY_ID: 'defaultSelectionEntryId',
  ENTRY_GROUP_ID: 'entryGroupId',
  ENTRY_ID: 'entryId',
  FIELD: 'field',
  GAME_SYSTEM_ID: 'gameSystemId',
  GAME_SYSTEM_NAME: 'gameSystemName',
  GAME_SYSTEM_REVISION: 'gameSystemRevision',
  HIDDEN: 'hidden',
  ID: 'id',
  IMPORT: 'import',
  IMPORT_ROOT_ENTRIES: 'importRootEntries',
  INCLUDE_CHILD_FORCES: 'includeChildForces',
  INCLUDE_CHILD_SELECTIONS: 'includeChildSelections',
  JOIN: 'join',
  LIBRARY: 'library',
  NAME: 'name',
  NUMBER: 'number',
  PAGE: 'page',
  PERCENT_VALUE: 'percentValue',
  PRIMARY: 'primary',
  PUBLICATION_DATE: 'publicationDate',
  PUBLICATION_ID: 'publicationId',
  PUBLISHER: 'publisher',
  PUBLISHER_URL: 'publisherUrl',
  REPEATS: 'repeats',
  REVISION: 'revision',
  ROUND_UP: 'roundUp',
  SCOPE: 'scope',
  SHARED: 'shared',
  SHORT_NAME: 'shortName',
  TARGET_ID: 'targetId',
  TYPE: 'type',
  TYPE_ID: 'typeId',
  TYPE_NAME: 'typeName',
  VALUE: 'value',
});
