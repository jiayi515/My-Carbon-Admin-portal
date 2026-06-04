# Scenarios — device-models

Acceptance scenarios for managing the device model catalog.

## Scenario: Admin lists models
Exercises: `listDeviceModels`
**Given** I am an Admin and several models exist
**When** I open the model list
**Then** I see each model's logo, name, family, description, OS, orientation and screen sizes
**And** a model with no uploaded logo shows the default logo for its OS

## Scenario: Admin filters models by OS
Exercises: `listDeviceModels`
**Given** I am an Admin and models exist across ANDROID, LINUX and RTOS
**When** I filter the list by operating system ANDROID
**Then** I see only ANDROID models

## Scenario: Admin views the model summary
Exercises: `getDeviceModelSummary`
**Given** I am an Admin and models exist across several operating systems
**When** I view the summary
**Then** I see the count of models for each operating system

## Scenario: Admin exports the filtered list
Exercises: `exportDeviceModels`
**Given** I am an Admin and I have filtered the list by operating system LINUX
**When** I export the list
**Then** I receive a file containing only the LINUX models
**And** its columns match the list view

## Scenario: Admin creates a model
Exercises: `createDeviceModel`
**Given** I am an Admin
**When** I create a model with a unique name, family, OS, orientation and a primary screen
**Then** the model is created and appears in the list

## Scenario: Duplicate model name is refused
Exercises: `createDeviceModel`
**Given** I am an Admin and a model named "N950" already exists
**When** I try to create another model named "N950"
**Then** the creation is refused for a name conflict
**And** no new model is created

## Scenario: Admin views model detail
Exercises: `getDeviceModel`
**Given** I am an Admin and a model exists
**When** I open its detail
**Then** I see its logo, name, description, OS, orientation, primary screen and secondary screen

## Scenario: Admin edits a model
Exercises: `updateDeviceModel`
**Given** I am an Admin and a model exists
**When** I change its description, orientation, screens and logo
**Then** the changes are saved
**And** the model name is unchanged

## Scenario: Admin deletes an unused model
Exercises: `deleteDeviceModel`
**Given** I am an Admin and a model has no devices and no firmware
**When** I delete it
**Then** the model is removed from the catalog

## Scenario: Deleting a model with devices is blocked
Exercises: `deleteDeviceModel`
**Given** I am an Admin and a model has at least one device belonging to it
**When** I try to delete it
**Then** the deletion is refused
**And** the model remains in the catalog

## Scenario: Deleting a model with firmware is blocked
Exercises: `deleteDeviceModel`
**Given** I am an Admin and a model has at least one firmware belonging to it
**When** I try to delete it
**Then** the deletion is refused
**And** the model remains in the catalog
